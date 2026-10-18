import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ArrowLeft, Flame, Phone } from 'lucide-react'
import { AppHeader, BottomNavigation } from '../components/AppChrome'
import { pb, hasPocketBase } from '../lib/pb'
import { useStudioConfig, DEFAULT_SLUG } from '../lib/studioSettings'
import { useCatalog } from '../lib/catalog'
import { computePrice, isHappyHour, rub, type PricedExtra } from '../lib/pricing'
import { HOUR, dayKey, dayStartMs, parsePb, toView } from '../lib/tz'
import { UNIT_RU } from '../types'

type Busy = { start: number; end: number }

export default function BookingPage() {
  const { slug = DEFAULT_SLUG } = useParams<{ slug: string }>()
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const { config } = useStudioConfig(slug)
  const { studio, settings } = config
  const tz = settings.tzOffsetMin
  const { halls, extras, loading, offline } = useCatalog(studio?.id)

  const [hallId, setHallId] = useState<string>(search.get('hall') || '')
  const [day, setDay] = useState(() => dayKey(Date.now(), tz))
  const [startH, setStartH] = useState<number | null>(null)
  const [hours, setHours] = useState(2)
  const [guests, setGuests] = useState(2)
  const [qty, setQty] = useState<Record<string, number>>({})
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState<Busy[]>([])
  const [now, setNow] = useState(() => Date.now())
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hall = halls.find((h) => h.id === hallId) || halls[0] || null
  const minH = Math.max(1, hall?.min_hours || 1)

  useEffect(() => {
    if (hall && hall.id !== hallId) setHallId(hall.id)
  }, [hall, hallId])

  // тик раз в минуту — «прошедшее» время блокируется само
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(t)
  }, [])

  // дни: сегодня + 13 дней вперёд по времени студии
  const days = useMemo(() => {
    const t0 = dayStartMs(dayKey(Date.now(), tz), tz)
    return Array.from({ length: 14 }, (_, i) => {
      const ms = t0 + i * 24 * HOUR
      return { key: dayKey(ms, tz), view: toView(ms, tz) }
    })
  }, [tz])

  // занятые интервалы зала (публичный эндпоинт: только время, без данных клиентов)
  useEffect(() => {
    if (!hall || offline || !hasPocketBase) {
      setBusy([])
      return
    }
    let off = false
    const d0 = dayStartMs(day, tz)
    const base = (import.meta.env.VITE_PB_URL as string).replace(/\/$/, '')
    const url = `${base}/api/neo/busy?hall=${encodeURIComponent(hall.id)}&from=${encodeURIComponent(new Date(d0 - 24 * HOUR).toISOString())}&to=${encodeURIComponent(new Date(d0 + 48 * HOUR).toISOString())}`
    void fetch(url)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: { start: string; end: string }[]) => {
        if (!off) setBusy(rows.map((r) => ({ start: parsePb(r.start), end: parsePb(r.end) })))
      })
      .catch(() => !off && setBusy([]))
    return () => {
      off = true
    }
  }, [hall, day, tz, offline])

  /** для каждого часа суток: можно ли начать и сколько часов максимум */
  const slots = useMemo(() => {
    const d0 = dayStartMs(day, tz)
    const buf = settings.cleanupMinutes * 60000
    return Array.from({ length: 24 }, (_, h) => {
      const start = d0 + h * HOUR
      let max = settings.maxHours
      if (!settings.open24) {
        if (h < settings.workStart) return { h, start, max: 0 }
        max = Math.min(max, settings.workEnd - h)
      }
      if (start < now + settings.leadMinutes * 60000) return { h, start, max: 0 }
      for (const b of busy) {
        if (b.end + buf > start && b.start - buf < start + minH * HOUR) return { h, start, max: 0 }
        if (b.start >= start) max = Math.min(max, Math.floor((b.start - buf - start) / HOUR))
      }
      return { h, start, max: max >= minH ? max : 0 }
    })
  }, [day, tz, busy, now, settings, minH])

  const slot = startH === null ? null : slots[startH]
  const maxHours = slot?.max || settings.maxHours

  // подгоняем длительность и гостей под выбранный зал / слот
  useEffect(() => {
    setHours((h) => Math.max(minH, Math.min(h, maxHours)))
  }, [minH, maxHours])
  useEffect(() => {
    if (hall) setGuests((g) => Math.max(1, Math.min(g, hall.capacity || 99)))
  }, [hall])
  useEffect(() => {
    if (startH !== null && slots[startH].max === 0) setStartH(null)
  }, [slots, startH])

  const lines: PricedExtra[] = extras
    .filter((x) => (qty[x.id] || 0) > 0)
    .map((x) => ({ id: x.id, name: x.name, price: x.price, unit: x.unit, qty: qty[x.id] }))

  const price = hall && slot && startH !== null ? computePrice(hall, settings, slot.start, hours, guests, lines) : null

  const timeLabel =
    slot && startH !== null
      ? `${format(toView(slot.start, tz), 'd MMMM, HH:mm', { locale: ru })}–${format(toView(slot.start + hours * HOUR, tz), 'HH:mm')}`
      : ''

  const digits = phone.replace(/\D/g, '')
  const ready = Boolean(hall && slot && startH !== null && name.trim().length >= 2 && digits.length >= 10 && !offline)

  async function submit() {
    if (!hall || !slot || !ready || sending) return
    setSending(true)
    setError(null)
    try {
      const rec = await pb.collection('bookings').create<{ total: number }>({
        studio_slug: slug,
        hall_id: hall.id,
        hall_name: hall.name,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        guests,
        hours,
        start_at: new Date(slot.start).toISOString(),
        end_at: new Date(slot.start + hours * HOUR).toISOString(),
        extras: lines.map((l) => ({ id: l.id, qty: l.qty })),
        total: price?.total ?? 0,
        status: 'pending',
        notes: notes.trim(),
      })
      try {
        localStorage.setItem('banya-booking', JSON.stringify({ name: name.trim(), phone: phone.trim(), hall: hall.name, when: timeLabel, total: rec.total, guests }))
      } catch {
        /* ignore */
      }
      navigate(`/s/${slug}/success?name=${encodeURIComponent(name.trim())}&hall=${encodeURIComponent(hall.name)}&time=${encodeURIComponent(timeLabel)}&total=${rec.total ?? price?.total ?? 0}`)
    } catch (e) {
      const m = (e as { response?: { message?: string; data?: Record<string, { message?: string }> } })?.response
      const first = m?.data ? Object.values(m.data)[0]?.message : undefined
      setError(first || m?.message || 'Не удалось отправить бронь. Попробуйте ещё раз или позвоните нам.')
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="pub">
        <AppHeader slug={slug} />
        <div style={{ minHeight: '60dvh', display: 'grid', placeItems: 'center' }}><div className="spinner" /></div>
        <BottomNavigation slug={slug} active="book" />
      </div>
    )
  }

  return (
    <div className="pub fade-in" style={{ paddingBottom: 190 }}>
      <AppHeader slug={slug} />
      <div className="container">
        <Link to={`/s/${slug}`} className="pub-muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, margin: '4px 0 6px' }}>
          <ArrowLeft size={16} /> На главную
        </Link>
        <h1 className="pub-h1">Бронь бани</h1>
        {offline && (
          <div className="pub-promo" style={{ borderColor: 'rgba(239,68,68,.4)', background: 'rgba(239,68,68,.08)' }}>
            Онлайн-бронирование сейчас недоступно.{studio?.phone && <> Позвоните: <a href={`tel:${studio.phone}`} style={{ color: 'var(--accent)' }}>{studio.phone}</a></>}
          </div>
        )}

        {halls.length > 1 && (
          <>
            <span className="pub-label">Зал</span>
            <div style={{ display: 'grid', gap: 8 }}>
              {halls.map((h) => (
                <button key={h.id} type="button" className={`pub-opt${h.id === hall?.id ? ' on' : ''}`} onClick={() => { setHallId(h.id); setStartH(null) }}>
                  <div className="pub-row"><b>{h.name}</b><b>{rub(h.price_per_hour)}/ч</b></div>
                  <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>до {h.capacity} гостей · от {h.min_hours || 1} ч</div>
                </button>
              ))}
            </div>
          </>
        )}

        <span className="pub-label">Дата</span>
        <div className="pub-days">
          {days.map((d) => (
            <button key={d.key} type="button" className={`pub-day${d.key === day ? ' on' : ''}`} onClick={() => { setDay(d.key); setStartH(null) }}>
              <small>{format(d.view, 'EEE', { locale: ru })}</small>
              <b>{format(d.view, 'd')}</b>
              <small>{format(d.view, 'MMM', { locale: ru })}</small>
            </button>
          ))}
        </div>

        <span className="pub-label">Время начала</span>
        <div className="pub-slots">
          {slots.map((s) => (
            <button key={s.h} type="button" disabled={s.max === 0} className={`pub-slot${startH === s.h ? ' on' : ''}`} onClick={() => setStartH(s.h)}>
              {String(s.h).padStart(2, '0')}:00
              {hall && s.max > 0 && isHappyHour(hall, settings, s.start) && <i title="Счастливый час" />}
            </button>
          ))}
        </div>
        {settings.happy.enabled && (
          <p className="pub-muted" style={{ fontSize: 12, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <i style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} /> счастливые часы — сниженная цена
          </p>
        )}

        {slot && startH !== null && (
          <>
            <span className="pub-label">Длительность</span>
            <div className="pub-card pub-step">
              <div>
                <b>{hours} ч</b>
                <div className="pub-muted" style={{ fontSize: 12 }}>до {format(toView(slot.start + hours * HOUR, tz), 'HH:mm')} · минимум {minH} ч</div>
              </div>
              <div className="ctr">
                <button type="button" disabled={hours <= minH} onClick={() => setHours((h) => h - 1)} aria-label="Меньше">−</button>
                <output>{hours}</output>
                <button type="button" disabled={hours >= maxHours} onClick={() => setHours((h) => h + 1)} aria-label="Больше">+</button>
              </div>
            </div>
          </>
        )}

        {hall && (
          <>
            <span className="pub-label">Гости</span>
            <div className="pub-card pub-step">
              <div>
                <b>{guests} {guests === 1 ? 'гость' : 'гостей'}</b>
                <div className="pub-muted" style={{ fontSize: 12 }}>
                  в цене {hall.included_guests}, максимум {hall.capacity}
                  {hall.extra_guest_price ? ` · +${rub(hall.extra_guest_price)}/ч за каждого сверх` : ''}
                </div>
              </div>
              <div className="ctr">
                <button type="button" disabled={guests <= 1} onClick={() => setGuests((g) => g - 1)} aria-label="Меньше">−</button>
                <output>{guests}</output>
                <button type="button" disabled={guests >= (hall.capacity || 99)} onClick={() => setGuests((g) => g + 1)} aria-label="Больше">+</button>
              </div>
            </div>
          </>
        )}

        {extras.length > 0 && (
          <>
            <span className="pub-label">Добавить к брони</span>
            <div className="pub-card" style={{ padding: '4px 16px' }}>
              {extras.map((x, i) => {
                const q = qty[x.id] || 0
                const single = x.unit !== 'item'
                return (
                  <div key={x.id} className="pub-step" style={{ padding: '11px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                    <div>
                      <b style={{ fontSize: 15 }}>{x.name}</b>
                      <div className="pub-muted" style={{ fontSize: 12 }}>{x.price > 0 ? `${rub(x.price)} ${UNIT_RU[x.unit]}` : 'уточняйте у администратора'}</div>
                    </div>
                    <div className="ctr">
                      <button type="button" disabled={q <= 0} onClick={() => setQty((m) => ({ ...m, [x.id]: q - 1 }))} aria-label="Убрать">−</button>
                      <output>{q}</output>
                      <button type="button" disabled={single ? q >= 1 : q >= 20} onClick={() => setQty((m) => ({ ...m, [x.id]: q + 1 }))} aria-label="Добавить">+</button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        <span className="pub-label">Контакты</span>
        <div style={{ display: 'grid', gap: 10 }}>
          <input className="input" placeholder="Ваше имя" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          <input className="input" placeholder="Телефон" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
          <textarea className="input" rows={2} placeholder="Пожелания (необязательно)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>

        {price && (
          <div className="pub-card" style={{ marginTop: 18 }}>
            <div className="pub-muted" style={{ marginBottom: 8, fontWeight: 700 }}>Расчёт</div>
            {price.baseHours > 0 && <Line a={`Аренда ${price.baseHours} ч × ${rub(hall!.price_per_hour)}`} b={rub(price.base)} />}
            {price.happyHours > 0 && <Line a={`Счастливые часы ${price.happyHours} ч × ${rub(hall!.price_happy || 0)}`} b={rub(price.happy)} />}
            {price.extraGuests > 0 && <Line a={`Доп. гости: ${price.extraGuests}`} b={rub(price.guestsFee)} />}
            {lines.map((l) => <Line key={l.id} a={`${l.name}${l.unit === 'item' ? ` × ${l.qty}` : ''}`} b={l.price > 0 ? rub(l.unit === 'hour' ? l.price * hours : l.unit === 'booking' ? l.price : l.price * l.qty) : 'по запросу'} />)}
          </div>
        )}
      </div>

      <div className="pub-sum">
        <div>
          {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 8 }}>{error}</p>}
          <div className="pub-row" style={{ marginBottom: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div className="pub-muted" style={{ fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{timeLabel || 'Выберите дату и время'}</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>{price ? rub(price.total) : '—'}</div>
            </div>
            {studio?.phone && <a href={`tel:${studio.phone}`} className="pub-round" aria-label="Позвонить"><Phone size={17} /></a>}
          </div>
          <button type="button" className="pub-btn" disabled={!ready || sending} onClick={() => void submit()}>
            <Flame size={17} /> {sending ? 'Отправляем…' : 'Забронировать'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Line({ a, b }: { a: string; b: string }) {
  return (
    <div className="pub-row pub-muted" style={{ padding: '4px 0' }}>
      <span>{a}</span>
      <span style={{ color: '#fff', whiteSpace: 'nowrap' }}>{b}</span>
    </div>
  )
}
