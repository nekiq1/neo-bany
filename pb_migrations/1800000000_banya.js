/// <reference path="../pb_data/types.d.ts" />
/**
 * Баня: studios, halls (залы), extras (допуслуги), works (галерея), bookings.
 * Идемпотентна: на пустой базе создаёт всё, на старой (детейлинг) — добавляет недостающие
 * коллекции и поля. Старые services/slots НЕ удаляются, но закрываются для публики.
 *
 * Права: публично — чтение витрины и создание брони; остальное — только админ.
 */
migrate(
  (app) => {
    const AUTH = '@request.auth.id != ""'
    const IMG = ['image/jpeg', 'image/png', 'image/webp']

    const findOrCreate = (name) => {
      try {
        return app.findCollectionByNameOrId(name)
      } catch (_) {
        return new Collection({ type: 'base', name: name })
      }
    }
    const add = (col, f) => {
      if (!col.fields.getByName(f.name)) col.fields.add(new Field(f))
    }
    const publicRead = (col) => {
      col.listRule = ''
      col.viewRule = ''
      col.createRule = AUTH
      col.updateRule = AUTH
      col.deleteRule = AUTH
    }

    // ---------- studios ----------
    const studios = findOrCreate('studios')
    add(studios, { type: 'text', name: 'slug', required: true })
    add(studios, { type: 'text', name: 'name', required: true })
    add(studios, { type: 'text', name: 'address' })
    add(studios, { type: 'text', name: 'description' })
    add(studios, { type: 'text', name: 'phone' })
    add(studios, { type: 'bool', name: 'is_active' })
    add(studios, { type: 'json', name: 'settings', maxSize: 2000000 })
    add(studios, { type: 'file', name: 'logo', maxSelect: 1, maxSize: 5242880, mimeTypes: IMG })
    add(studios, { type: 'file', name: 'hero', maxSelect: 1, maxSize: 8388608, mimeTypes: IMG })
    studios.indexes = ['CREATE UNIQUE INDEX idx_studios_slug ON studios (slug)']
    publicRead(studios)
    app.save(studios)

    // ---------- halls ----------
    const halls = findOrCreate('halls')
    add(halls, { type: 'text', name: 'studio_id' })
    add(halls, { type: 'text', name: 'name', required: true })
    add(halls, { type: 'text', name: 'description' })
    add(halls, { type: 'text', name: 'features' }) // через запятую
    add(halls, { type: 'number', name: 'capacity' })
    add(halls, { type: 'number', name: 'included_guests' })
    add(halls, { type: 'number', name: 'extra_guest_price' })
    add(halls, { type: 'number', name: 'price_per_hour', required: true })
    add(halls, { type: 'number', name: 'price_happy' })
    add(halls, { type: 'number', name: 'min_hours' })
    add(halls, { type: 'number', name: 'sort_order' })
    add(halls, { type: 'bool', name: 'is_active' })
    add(halls, { type: 'file', name: 'photo', maxSelect: 1, maxSize: 5242880, mimeTypes: IMG })
    publicRead(halls)
    app.save(halls)

    // ---------- extras ----------
    const extras = findOrCreate('extras')
    add(extras, { type: 'text', name: 'studio_id' })
    add(extras, { type: 'text', name: 'name', required: true })
    add(extras, { type: 'number', name: 'price' })
    add(extras, { type: 'select', name: 'unit', maxSelect: 1, values: ['item', 'booking', 'hour'] })
    add(extras, { type: 'number', name: 'sort_order' })
    add(extras, { type: 'bool', name: 'is_active' })
    publicRead(extras)
    app.save(extras)

    // ---------- works (галерея) ----------
    const works = findOrCreate('works')
    add(works, { type: 'text', name: 'studio_id' })
    add(works, { type: 'text', name: 'title' })
    add(works, { type: 'file', name: 'image', required: true, maxSelect: 1, maxSize: 8388608, mimeTypes: IMG })
    add(works, { type: 'number', name: 'sort_order' })
    add(works, { type: 'number', name: 'scale' })
    add(works, { type: 'number', name: 'x' })
    add(works, { type: 'number', name: 'y' })
    publicRead(works)
    app.save(works)

    // ---------- bookings ----------
    const bookings = findOrCreate('bookings')
    add(bookings, { type: 'text', name: 'studio_id' })
    add(bookings, { type: 'text', name: 'studio_slug' })
    add(bookings, { type: 'text', name: 'hall_id' }) // пусто у блокировки «все залы»
    add(bookings, { type: 'text', name: 'hall_name' })
    add(bookings, { type: 'text', name: 'customer_name', required: true })
    add(bookings, { type: 'text', name: 'customer_phone', required: true })
    add(bookings, { type: 'number', name: 'guests' })
    add(bookings, { type: 'number', name: 'hours' })
    add(bookings, { type: 'date', name: 'start_at', required: true })
    add(bookings, { type: 'date', name: 'end_at', required: true })
    add(bookings, { type: 'json', name: 'extras', maxSize: 200000 })
    add(bookings, { type: 'number', name: 'total' })
    add(bookings, { type: 'bool', name: 'paid' })
    add(bookings, { type: 'text', name: 'notes' })
    add(bookings, {
      type: 'select', name: 'status', required: true, maxSelect: 1,
      values: ['pending', 'confirmed', 'completed', 'cancelled'],
    })
    bookings.indexes = [
      'CREATE INDEX idx_bookings_start ON bookings (start_at)',
      'CREATE INDEX idx_bookings_hall ON bookings (hall_id)',
    ]
    bookings.listRule = AUTH
    bookings.viewRule = AUTH
    bookings.createRule = ''
    bookings.updateRule = AUTH
    bookings.deleteRule = AUTH
    app.save(bookings)

    // ---------- наследие детейлинга: закрываем, не удаляем ----------
    for (const name of ['services', 'slots']) {
      try {
        const c = app.findCollectionByNameOrId(name)
        c.listRule = AUTH
        c.viewRule = AUTH
        c.createRule = AUTH
        c.updateRule = AUTH
        c.deleteRule = AUTH
        app.save(c)
      } catch (_) {}
    }

    // ---------- users: без самостоятельной регистрации ----------
    try {
      const users = app.findCollectionByNameOrId('users')
      users.createRule = null
      app.save(users)
    } catch (_) {}

    // ---------- демо-данные (по образцу бани «Капля», СПб) ----------
    let studio
    try {
      studio = app.findFirstRecordByFilter('studios', 'slug = {:s}', { s: 'kaplya' })
    } catch (_) {
      studio = new Record(studios)
      studio.set('slug', 'kaplya')
      studio.set('name', 'Капля')
      studio.set('address', 'Санкт-Петербург, Мичманская ул., 4')
      studio.set('phone', '+79214260036')
      studio.set('description', 'Баня и сауна с бассейном на Васильевском острове. Русская и финская парная, караоке, бильярд — круглосуточно.')
      studio.set('is_active', true)
      studio.set('settings', {
        tzOffsetMin: 180,
        open24: true,
        workStart: 10,
        workEnd: 22,
        maxHours: 12,
        cleanupMinutes: 30,
        leadMinutes: 60,
        happy: { enabled: true, from: 10, to: 17, days: [1, 2, 3, 4, 5] },
        features: ['Бассейн', 'Русская парная', 'Финская парная', 'Караоке', 'Бильярд', 'Wi‑Fi', 'Парковка', 'Оплата картой', 'Доставка еды'],
        promos: [
          { title: 'Счастливые часы', text: 'В будни с 10:00 до 17:00 — от 950 ₽ в час' },
          { title: 'День рождения', text: 'Скидка 15% на аренду' },
          { title: 'Для пар', text: 'Скидка 10% на аренду' },
        ],
        site: 'https://sauna-vo.ru',
        lat: 59.945914,
        lng: 30.208349,
        heroScale: 1, heroX: 0, heroY: 0,
      })
      app.save(studio)

      const hallsDemo = [
        ['Русская баня', 'Классическая парная на дровах-имитации, купель и комната отдыха.', 'Русская парная, Купель, Комната отдыха, Wi‑Fi', 6, 4, 300, 1500, 950, 2],
        ['Финская сауна', 'Сухой жар, панорамная парная и мягкая зона отдыха.', 'Финская парная, Душ, Караоке, Wi‑Fi', 6, 4, 300, 1500, 950, 2],
        ['Сауна с бассейном', 'Бассейн с гидромассажем и водопадом, подсветка, парная.', 'Бассейн, Гидромассаж, Водопад, Караоке, Бильярд', 8, 6, 300, 1900, 1200, 2],
        ['Lux', 'Большой зал для компании: бассейн, бильярд, зона барбекю.', 'Бассейн, Бильярд, Барбекю, Караоке, Две парные', 12, 8, 250, 1900, 1200, 3],
      ]
      hallsDemo.forEach((h, i) => {
        const r = new Record(halls)
        r.set('studio_id', studio.id)
        r.set('name', h[0]); r.set('description', h[1]); r.set('features', h[2])
        r.set('capacity', h[3]); r.set('included_guests', h[4]); r.set('extra_guest_price', h[5])
        r.set('price_per_hour', h[6]); r.set('price_happy', h[7]); r.set('min_hours', h[8])
        r.set('sort_order', i + 1); r.set('is_active', true)
        app.save(r)
      })

      const extrasDemo = [
        ['Веник берёзовый', 350, 'item'],
        ['Веник дубовый', 400, 'item'],
        ['Полотенце', 150, 'item'],
        ['Простыня', 150, 'item'],
        ['Тапочки', 100, 'item'],
        ['Шапка для парной', 120, 'item'],
        ['Чайный набор', 500, 'booking'],
      ]
      extrasDemo.forEach((x, i) => {
        const r = new Record(extras)
        r.set('studio_id', studio.id)
        r.set('name', x[0]); r.set('price', x[1]); r.set('unit', x[2])
        r.set('sort_order', i + 1); r.set('is_active', true)
        app.save(r)
      })
    }
  },
  (app) => {
    for (const n of ['halls', 'extras', 'works']) {
      try { app.delete(app.findCollectionByNameOrId(n)) } catch (_) {}
    }
  },
)
