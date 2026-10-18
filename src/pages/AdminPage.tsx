// Админ-панель «Расписание»: записи + управление сайтом (всё хранится в PocketBase)
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  addDays, endOfDay, endOfWeek, format, parseISO, startOfDay, startOfWeek, subDays,
} from 'date-fns'
import { ru } from 'date-fns/locale'
import {
  Calendar, ChevronLeft, ChevronRight, Image as ImageIcon, LogOut, MapPin, Phone, Plus,
  SlidersHorizontal, Stamp, Trash2, Upload, Wrench, Lock, ExternalLink, Sparkles, Users,
} from 'lucide-react'
import { pb, hasPocketBase, adminLogin, adminLogout, isAdminAuthed } from '../lib/pb'
import { fetchStudioConfig, normalizeSettings, DEFAULT_SLUG, type StudioRecord } from '../lib/studioSettings'
import { rub } from '../lib/pricing'
import { dayKey, parsePb, toView } from '../lib/tz'
import { Toast, STATUS_RU, errText } from './admin/ui'
import { isBlock, type BookingRow, type SectionProps } from './admin/types'
import AddBookingSheet from './admin/AddBookingSheet'
import HoursSection from './admin/HoursSection'
import ContactsSection from './admin/ContactsSection'
import ServicesSection from './admin/ServicesSection'
import PromosSection from './admin/PromosSection'
import WorksSection from './admin/WorksSection'
import BrandImageSection from './admin/BrandImageSection'

type View = null | 'add' | 'hours' | 'contacts' | 'cards' | 'services' | 'logo' | 'hero' | 'works' | 'promos'

const ATTEMPTS_KEY = 'neo-admin-attempts'
const LOCK_KEY = 'neo-admin-lock'
const MAX_ATTEMPTS = 5
const LOCK_MS = 5 * 60 * 1000

const num = (k: string) => {
  try {
    return Number(sessionStorage.getItem(k) || 0)
  } catch {
    return 0
  }
}
const put = (k: string, v: string | null) => {
  try {
    if (v === null) sessionStorage.removeItem(k)
    else sessionStorage.setItem(k, v)
  } catch {
    /* ignore */
  }
}

/** PocketBase хранит даты как "2026-10-18 10:00:00.000Z" */
const pbDate = (d: Date) => d.toISOString().replace('T', ' ')

export default function AdminPage() {
  const [authed, setAuthed] = useState(() => isAdminAuthed())
  const [studio, setStudio] = useState<StudioRecord | null>(null)
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [loading, setLoading] = useState(false)
  const [view, setView] = useState<View>(null)
  const [mode, setMode] = useState<'day' | 'week'>('week')
  const [date, setDate] = useState(() => startOfDay(new Date()))
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null)
  const toastTimer = useRef<number | undefined>(undefined)

  const notify = useCallback((msg: string, err?: boolean) => {
    setToast({ msg, err })
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), err ? 4500 : 2200)
  }, [])

  // ---- студия (создаём запись, если её ещё нет) ----
  const loadStudio = useCallback(async () => {
    const cfg = await fetchStudioConfig(DEFAULT_SLUG)
    if (cfg.studio) return setStudio(cfg.studio)
    try {
      const created = await pb.collection('studios').create<StudioRecord>({
        slug: DEFAULT_SLUG, name: 'Капля', is_active: true,
        address: 'Санкт-Петербург, Мичманская ул., 4', phone: '+79214260036',
      })
      setStudio(created)
    } catch (e) {
      notify(errText(e), true)
    }
  }, [notify])

  // ---- записи за выбранный период ----
  const range = useMemo(() => {
    if (mode === 'day') return { from: startOfDay(date), to: endOfDay(date) }
    return { from: startOfWeek(date, { weekStartsOn: 1 }), to: endOfWeek(date, { weekStartsOn: 1 }) }
  }, [date, mode])

  const loadBookings = useCallback(async () => {
    setLoading(true)
    try {
      const list = await pb.collection('bookings').getFullList<BookingRow>({
        filter: `start_at >= "${pbDate(range.from)}" && start_at <= "${pbDate(range.to)}"`,
        sort: 'start_at',
      })
      setBookings(list)
    } catch (e) {
      notify(errText(e), true)
    } finally {
      setLoading(false)
    }
  }, [range, notify])

  useEffect(() => {
    if (authed) void loadStudio()
  }, [authed, loadStudio])

  useEffect(() => {
    if (authed) void loadBookings()
  }, [authed, loadBookings])

  // новые заявки с сайта появляются сразу
  useEffect(() => {
    if (!authed) return
    void pb.collection('bookings').subscribe('*', () => void loadBookings()).catch(() => undefined)
    return () => {
      void pb.collection('bookings').unsubscribe('*').catch(() => undefined)
    }
  }, [authed, loadBookings])

  async function setStatus(id: string, status: BookingRow['status']) {
    try {
      await pb.collection('bookings').update(id, { status })
      setBookings((l) => l.map((b) => (b.id === id ? { ...b, status } : b)))
    } catch (e) {
      notify(errText(e), true)
    }
  }

  async function setPaid(id: string, paid: boolean) {
    try {
      await pb.collection('bookings').update(id, { paid })
      setBookings((l) => l.map((b) => (b.id === id ? { ...b, paid } : b)))
    } catch (e) {
      notify(errText(e), true)
    }
  }

  async function removeBooking(b: BookingRow) {
    if (!window.confirm(isBlock(b) ? 'Снять блокировку?' : `Удалить бронь ${b.customer_name}?`)) return
    try {
      await pb.collection('bookings').delete(b.id)
      setBookings((l) => l.filter((x) => x.id !== b.id))
    } catch (e) {
      notify(errText(e), true)
    }
  }

  // ---- вход ----
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginErr, setLoginErr] = useState<string | null>(null)
  const [lockLeft, setLockLeft] = useState(0)

  useEffect(() => {
    const tick = () => {
      const left = Math.max(0, num(LOCK_KEY) - Date.now())
      setLockLeft(left)
      if (left === 0 && num(LOCK_KEY) > 0) {
        put(LOCK_KEY, null)
        put(ATTEMPTS_KEY, '0')
      }
    }
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoginErr(null)
    if (Date.now() < num(LOCK_KEY)) return setLoginErr('Слишком много попыток. Подождите.')
    if (!hasPocketBase) return setLoginErr('PocketBase не настроен (VITE_PB_URL).')
    try {
      await adminLogin(email.trim(), password)
      put(ATTEMPTS_KEY, '0')
      put(LOCK_KEY, null)
      setPassword('')
      setAuthed(true)
    } catch {
      const n = num(ATTEMPTS_KEY) + 1
      put(ATTEMPTS_KEY, String(n))
      if (n >= MAX_ATTEMPTS) {
        put(LOCK_KEY, String(Date.now() + LOCK_MS))
        setLoginErr('Неверный email или пароль. Блокировка на 5 минут.')
      } else setLoginErr(`Неверный email или пароль. Осталось попыток: ${MAX_ATTEMPTS - n}`)
    }
  }

  function logout() {
    adminLogout()
    setAuthed(false)
    setStudio(null)
    setBookings([])
  }

  // ---- производные ----
  const clients = useMemo(() => bookings.filter((b) => !isBlock(b)), [bookings])
  const tz = normalizeSettings(studio?.settings).tzOffsetMin
  const tv = useCallback((iso: string) => toView(parsePb(iso), tz), [tz])

  const stats = useMemo(() => {
    const active = clients.filter((b) => b.status !== 'cancelled')
    const money = clients.filter((b) => b.status === 'completed' || (b.paid && b.status !== 'cancelled'))
    return {
      total: active.length,
      done: clients.filter((b) => b.status === 'completed').length,
      revenue: money.reduce((sum, b) => sum + (Number(b.total) || 0), 0),
    }
  }, [clients])

  const groups = useMemo(() => {
    const m = new Map<string, BookingRow[]>()
    for (const b of bookings) {
      const k = dayKey(parsePb(b.start_at), tz)
      m.set(k, [...(m.get(k) || []), b])
    }
    return [...m.entries()]
  }, [bookings, tz])

  const step = mode === 'day' ? 1 : 7
  const dateLabel =
    mode === 'day'
      ? format(date, "d MMM yyyy 'г.'", { locale: ru })
      : `${format(range.from, 'd MMM', { locale: ru })} – ${format(range.to, "d MMM yyyy 'г.'", { locale: ru })}`

  // ================= экран входа =================
  if (!authed) {
    const locked = lockLeft > 0
    return (
      <div className="adm" style={{ display: 'grid', placeItems: 'center', padding: 20 }}>
        <form onSubmit={handleLogin} className="adm-glass" style={{ width: '100%', maxWidth: 380, padding: 26 }}>
          <h1 className="adm-h1" style={{ fontSize: 28 }}>Расписание</h1>
          <p className="adm-sub" style={{ marginBottom: 22 }}>Вход для администратора</p>
          <label className="adm-label">Email</label>
          <input className="adm-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" disabled={locked} />
          <label className="adm-label" style={{ marginTop: 14 }}>Пароль</label>
          <input className="adm-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" disabled={locked} />
          {loginErr && <p style={{ color: '#f87171', fontSize: 13, marginTop: 12 }}>{loginErr}</p>}
          {locked && <p className="adm-sub">Разблокировка через {Math.ceil(lockLeft / 1000)} с</p>}
          <button type="submit" className="adm-pill adm-primary" style={{ width: '100%', marginTop: 20 }} disabled={locked}>
            <Lock size={16} /> Войти
          </button>
        </form>
      </div>
    )
  }

  const sectionProps: SectionProps | null = studio
    ? {
        studio,
        onClose: () => setView(null),
        notify,
        onChanged: loadStudio,
      }
    : null

  const menu: { v: View; label: string; icon: React.ReactNode; primary?: boolean }[] = [
    { v: 'add', label: 'Добавить запись', icon: <Plus size={19} />, primary: true },
    { v: 'hours', label: 'Часы работы', icon: <Calendar size={18} /> },
    { v: 'contacts', label: 'Контакты', icon: <MapPin size={18} /> },
    { v: 'cards', label: 'Карточки витрины', icon: <SlidersHorizontal size={18} /> },
    { v: 'services', label: 'Услуги', icon: <Wrench size={18} /> },
    { v: 'logo', label: 'Логотип', icon: <Stamp size={18} /> },
    { v: 'hero', label: 'Главное фото', icon: <ImageIcon size={18} /> },
    { v: 'works', label: 'Работы', icon: <Upload size={18} /> },
    { v: 'promos', label: 'Акции', icon: <Sparkles size={18} /> },
  ]

  return (
    <div className="adm fade-in">
      <div className="adm-wrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <h1 className="adm-h1">Расписание</h1>
            <p className="adm-sub">{studio?.name || 'Капля'}</p>
          </div>
          <button type="button" className="adm-icon-btn" onClick={logout} aria-label="Выйти">
            <LogOut size={19} />
          </button>
        </div>

        <span className="adm-label">Дата</span>
        <div className="adm-datebar">
          <button type="button" className="adm-icon-btn" onClick={() => setDate((d) => subDays(d, step))} aria-label="Назад">
            <ChevronLeft size={20} />
          </button>
          <div className="adm-glass adm-date">{dateLabel}</div>
          <button type="button" className="adm-icon-btn" onClick={() => setDate((d) => addDays(d, step))} aria-label="Вперёд">
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="adm-seg">
          <button type="button" className={`adm-pill${mode === 'day' ? ' on' : ''}`} onClick={() => setMode('day')}>День</button>
          <button type="button" className={`adm-pill${mode === 'week' ? ' on' : ''}`} onClick={() => setMode('week')}>Неделя</button>
        </div>

        <div className="adm-stats">
          <div className="adm-glass adm-stat"><small>Заезды</small><b>{stats.total}</b></div>
          <div className="adm-glass adm-stat"><small>Выполнено</small><b>{stats.done}</b></div>
          <div className="adm-glass adm-stat"><small>Получено</small><b>{stats.revenue.toLocaleString('ru-RU')} ₽</b></div>
        </div>

        <div className="adm-menu">
          {menu.map((m) => (
            <button key={m.label} type="button" className={`adm-pill${m.primary ? ' adm-primary' : ''}`} style={m.v === 'promos' ? { gridColumn: '1 / -1' } : undefined} disabled={!studio} onClick={() => setView(m.v)}>
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>

        <h2 style={{ fontSize: 17, fontWeight: 800, marginBottom: 12 }}>Брони ({clients.length})</h2>
        {loading && <div className="spinner" style={{ margin: '20px auto' }} />}
        {!loading && bookings.length === 0 && (
          <div className="adm-glass adm-card" style={{ textAlign: 'center', color: '#8b95a8', padding: 28 }}>
            Нет броней за выбранный период
          </div>
        )}

        {groups.map(([day, list]) => (
          <div key={day}>
            {mode === 'week' && (
              <div className="adm-label" style={{ margin: '14px 0 8px', textTransform: 'capitalize' }}>
                {format(parseISO(day), 'EEEE, d MMMM', { locale: ru })}
                {day === dayKey(Date.now(), tz) ? ' · сегодня' : ''}
              </div>
            )}
            {list.map((b) =>
              isBlock(b) ? (
                <div key={b.id} className="adm-glass adm-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.7 }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>Блокировка · {b.hall_name || 'Все залы'}</div>
                    <div className="adm-sub">{format(tv(b.start_at), 'HH:mm')} – {format(tv(b.end_at), 'HH:mm')}{b.notes ? ` · ${b.notes}` : ''}</div>
                  </div>
                  <button type="button" className="adm-icon-btn" onClick={() => void removeBooking(b)} aria-label="Снять">
                    <Trash2 size={17} color="#ff6b6b" />
                  </button>
                </div>
              ) : (
                <article key={b.id} className="adm-glass adm-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                    <div style={{ fontWeight: 700, fontSize: 16 }}>{b.hall_name || 'Зал'}</div>
                    <span className={`adm-badge ${b.status}`}>{STATUS_RU[b.status] || b.status}</span>
                  </div>
                  <div style={{ fontSize: 15 }}>
                    {format(tv(b.start_at), mode === 'day' ? 'HH:mm' : 'd MMM, HH:mm', { locale: ru })} – {format(tv(b.end_at), 'HH:mm')}
                    {b.hours ? ` · ${b.hours} ч` : ''}
                  </div>
                  <div className="adm-sub" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {b.customer_name} ·
                    <a href={`tel:${b.customer_phone}`} style={{ color: '#7cb9ff', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Phone size={13} />{b.customer_phone}
                    </a>
                  </div>
                  <div className="adm-sub" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    {b.guests ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Users size={13} />{b.guests}</span> : null}
                    {b.total ? <span style={{ color: '#fff', fontWeight: 700 }}>{rub(Number(b.total))}</span> : null}
                    {b.paid && <span className="adm-badge completed">Оплачено</span>}
                  </div>
                  {Array.isArray(b.extras) && b.extras.length > 0 && (
                    <div className="adm-sub">+ {b.extras.map((x) => `${x.name}${x.qty > 1 ? ` ×${x.qty}` : ''}`).join(', ')}</div>
                  )}
                  {b.notes && <div className="adm-sub">«{b.notes}»</div>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                    {b.status === 'pending' && (
                      <button type="button" className="adm-pill adm-primary" style={{ padding: '9px 16px', fontSize: 13 }} onClick={() => void setStatus(b.id, 'confirmed')}>Подтвердить</button>
                    )}
                    {b.status === 'confirmed' && (
                      <button type="button" className="adm-pill adm-primary" style={{ padding: '9px 16px', fontSize: 13 }} onClick={() => void setStatus(b.id, 'completed')}>Выполнено</button>
                    )}
                    {b.status !== 'cancelled' && !b.paid && b.status !== 'completed' && (
                      <button type="button" className="adm-pill" style={{ padding: '9px 16px', fontSize: 13 }} onClick={() => void setPaid(b.id, true)}>Оплачено</button>
                    )}
                    {(b.status === 'cancelled' || b.status === 'completed') && (
                      <button type="button" className="adm-pill" style={{ padding: '9px 16px', fontSize: 13 }} onClick={() => void setStatus(b.id, 'pending')}>Вернуть</button>
                    )}
                    {b.status !== 'cancelled' && b.status !== 'completed' && (
                      <button type="button" className="adm-pill adm-danger" style={{ padding: '9px 16px', fontSize: 13 }} onClick={() => void setStatus(b.id, 'cancelled')}>Отменить</button>
                    )}
                    <button type="button" className="adm-icon-btn" style={{ width: 38, height: 38, marginLeft: 'auto' }} onClick={() => void removeBooking(b)} aria-label="Удалить">
                      <Trash2 size={16} color="#ff6b6b" />
                    </button>
                  </div>
                </article>
              ),
            )}
          </div>
        ))}

        <Link to={`/s/${DEFAULT_SLUG}`} className="adm-sub" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24 }}>
          <ExternalLink size={14} /> Открыть сайт
        </Link>
      </div>

      {sectionProps && view === 'add' && <AddBookingSheet {...sectionProps} defaultDate={date} onChanged={loadBookings} />
      }
      {sectionProps && view === 'promos' && <PromosSection {...sectionProps} />}
      {sectionProps && view === 'hours' && <HoursSection {...sectionProps} />}
      {sectionProps && view === 'contacts' && <ContactsSection {...sectionProps} />}
      {sectionProps && view === 'services' && <ServicesSection {...sectionProps} />}
      {sectionProps && view === 'cards' && <WorksSection {...sectionProps} mode="cards" />}
      {sectionProps && view === 'works' && <WorksSection {...sectionProps} mode="upload" />}
      {sectionProps && view === 'logo' && <BrandImageSection {...sectionProps} kind="logo" />}
      {sectionProps && view === 'hero' && <BrandImageSection {...sectionProps} kind="hero" />}

      <Toast msg={toast?.msg ?? null} error={toast?.err} />
    </div>
  )
}
