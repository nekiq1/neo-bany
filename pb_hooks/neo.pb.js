/// <reference path="../pb_data/types.d.ts" />
/**
 * Серверная логика бронирования бани.
 *
 * GET /api/neo/busy?hall=ID&from=ISO&to=ISO
 *   → [{ "start": "...", "end": "..." }]
 *   Публично отдаёт ТОЛЬКО занятые интервалы зала (без имён и телефонов).
 *   Блокировки «все залы» (пустой hall_id) попадают в выдачу любого зала.
 */
routerAdd('GET', '/api/neo/busy', (e) => {
  const q = e.request.url.query()
  const hall = String(q.get('hall') || '')
  const from = String(q.get('from') || '').replace('T', ' ')
  const to = String(q.get('to') || '').replace('T', ' ')
  if (!hall || !from || !to) return e.json(400, { error: 'hall, from, to required' })

  const rows = $app.findRecordsByFilter(
    'bookings',
    "(hall_id = {:h} || hall_id = '') && status != 'cancelled' && start_at < {:to} && end_at > {:from}",
    'start_at',
    500,
    0,
    { h: hall, from: from, to: to },
  )
  return e.json(
    200,
    rows.map((r) => ({ start: String(r.get('start_at')), end: String(r.get('end_at')) })),
  )
})

/**
 * Бронь с сайта нельзя «улучшить» с клиента. Сервер:
 *  - принудительно ставит status=pending, paid=false;
 *  - берёт зал, цены, допуслуги из БД и сам считает итог;
 *  - проверяет часы (min/max), число гостей, «не в прошлом», пересечения (+ время на уборку).
 * Запросы админа (авторизованного) не ограничиваем.
 */
onRecordCreateRequest((e) => {
  if (e.auth) return e.next()

  const pricing = require(`${__hooks}/pricing.js`)
  const rec = e.record
  const body = e.requestInfo().body || {}

  const name = String(rec.get('customer_name') || '')
  if (name.indexOf('Блокировка') !== -1 || rec.get('customer_phone') === 'block') {
    throw new BadRequestError('Недопустимое имя')
  }

  const hallId = String(rec.get('hall_id') || '')
  let hall
  try {
    hall = $app.findRecordById('halls', hallId)
  } catch (_) {
    throw new BadRequestError('Зал не найден')
  }
  if (!hall.get('is_active')) throw new BadRequestError('Зал недоступен')

  let studio = null
  try {
    studio = $app.findRecordById('studios', String(hall.get('studio_id')))
  } catch (_) {}
  const s = pricing.parseJson(studio ? studio.get('settings') : null, {}) || {}
  const settings = {
    tzOffsetMin: typeof s.tzOffsetMin === 'number' ? s.tzOffsetMin : 180,
    maxHours: s.maxHours > 0 ? s.maxHours : 12,
    cleanupMinutes: s.cleanupMinutes >= 0 ? s.cleanupMinutes : 30,
    leadMinutes: s.leadMinutes >= 0 ? s.leadMinutes : 60,
    open24: s.open24 !== false,
    workStart: s.workStart >= 0 ? s.workStart : 10,
    workEnd: s.workEnd > 0 ? s.workEnd : 22,
    happy: s.happy || { enabled: false, from: 0, to: 0, days: [] },
  }

  const startMs = new Date(String(rec.get('start_at')).replace(' ', 'T')).getTime()
  const hours = Number(rec.get('hours'))
  if (!(startMs > 0)) throw new BadRequestError('Неверное время начала')
  if (!(hours >= 1) || Math.floor(hours) !== hours) throw new BadRequestError('Неверная длительность')
  const minHours = hall.get('min_hours') > 0 ? hall.get('min_hours') : 1
  if (hours < minHours) throw new BadRequestError('Минимум ' + minHours + ' ч')
  if (hours > settings.maxHours) throw new BadRequestError('Максимум ' + settings.maxHours + ' ч')
  if (startMs < Date.now() + settings.leadMinutes * 60000 - 60000) {
    throw new BadRequestError('Это время уже недоступно')
  }

  const guests = Number(rec.get('guests'))
  const cap = hall.get('capacity') > 0 ? hall.get('capacity') : 99
  if (!(guests >= 1) || guests > cap) throw new BadRequestError('Гостей: от 1 до ' + cap)

  const endMs = startMs + hours * pricing.HOUR
  if (!settings.open24) {
    const d = new Date(startMs + settings.tzOffsetMin * 60000)
    const h0 = d.getUTCHours() + d.getUTCMinutes() / 60
    if (h0 < settings.workStart || h0 + hours > settings.workEnd) {
      throw new BadRequestError('Вне часов работы')
    }
  }

  // пересечения с учётом уборки
  const buf = settings.cleanupMinutes * 60000
  const iso = (ms) => new Date(ms).toISOString().replace('T', ' ')
  const clash = $app.findRecordsByFilter(
    'bookings',
    "(hall_id = {:h} || hall_id = '') && status != 'cancelled' && start_at < {:to} && end_at > {:from}",
    '',
    1,
    0,
    { h: hallId, from: iso(startMs - buf), to: iso(endMs + buf) },
  )
  if (clash.length > 0) throw new BadRequestError('Это время уже занято')

  // допуслуги — по id из БД, цены только серверные
  const lines = []
  const input = Array.isArray(body.extras) ? body.extras : []
  for (let i = 0; i < input.length; i++) {
    const qty = Math.min(50, Math.max(0, Math.floor(Number(input[i].qty) || 0)))
    if (!qty) continue
    try {
      const x = $app.findRecordById('extras', String(input[i].id))
      if (!x.get('is_active')) continue
      lines.push({ id: x.id, name: x.get('name'), price: x.get('price'), unit: x.get('unit') || 'item', qty: qty })
    } catch (_) {}
  }

  const calc = pricing.priceFor(
    {
      price_per_hour: hall.get('price_per_hour'),
      price_happy: hall.get('price_happy'),
      included_guests: hall.get('included_guests'),
      extra_guest_price: hall.get('extra_guest_price'),
    },
    settings,
    startMs,
    hours,
    guests,
    lines,
  )

  rec.set('studio_id', hall.get('studio_id'))
  rec.set('hall_name', hall.get('name'))
  rec.set('end_at', new Date(endMs).toISOString().replace('T', ' '))
  rec.set('extras', lines)
  rec.set('total', calc.total)
  rec.set('status', 'pending')
  rec.set('paid', false)
  e.next()
}, 'bookings')
