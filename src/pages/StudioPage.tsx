import { Link, useParams } from 'react-router-dom'
import { ArrowUpRight, Clock, MapPin, Phone, Users, Flame, User, Sparkles, ExternalLink } from 'lucide-react'
import { BottomNavigation } from '../components/AppChrome'
import { cropTransform } from '../components/ImageCropEditor'
import { useStudioConfig, useWorks, workLabel, DEFAULT_SLUG } from '../lib/studioSettings'
import { useCatalog, minHourPrice } from '../lib/catalog'
import { rub } from '../lib/pricing'
import { UNIT_RU } from '../types'

export default function StudioPage() {
  const { slug = DEFAULT_SLUG } = useParams<{ slug: string }>()
  const { config } = useStudioConfig(slug)
  const cards = useWorks()
  const { studio, settings } = config
  const { halls, extras, loading, offline } = useCatalog(studio?.id)

  const name = studio?.name || 'Капля'
  const phone = studio?.phone || ''
  const address = studio?.address || ''
  const from = minHourPrice(halls, settings)
  const maxGuests = halls.length ? Math.max(...halls.map((h) => h.capacity || 0)) : 0
  const route =
    settings.lat && settings.lng
      ? `https://yandex.ru/maps/?rtext=~${settings.lat},${settings.lng}&rtt=auto`
      : `https://yandex.ru/maps/?text=${encodeURIComponent(address)}`

  return (
    <div className="pub fade-in">
      <div className="pub-top">
        <div className="pub-brand">
          <img src={config.logoUrl} alt={name} />
          <span>{name}</span>
        </div>
        <Link to={`/s/${slug}/mine`} className="pub-round" aria-label="Моя бронь">
          <User size={18} />
        </Link>
      </div>

      <div className="container" style={{ paddingTop: 4 }}>
        <div className="pub-hero">
          <img
            src={config.heroUrl}
            alt={name}
            style={{ ...cropTransform({ scale: settings.heroScale, x: settings.heroX, y: settings.heroY }), width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <Link to={`/s/${slug}/book`} className="pub-cta">
            Забронировать <ArrowUpRight size={19} />
          </Link>
        </div>

        <h1 className="pub-h1">Баня «{name}»</h1>
        <p className="pub-muted" style={{ maxWidth: 380 }}>{studio?.description}</p>

        <div className="pub-grid3">
          <div className="pub-stat"><b>{halls.length || '—'}</b><span>{halls.length === 1 ? 'зал' : 'зала · залов'}</span></div>
          <div className="pub-stat"><b>{from ? rub(from) : '—'}</b><span>за час, от</span></div>
          <div className="pub-stat"><b>{maxGuests || '—'}</b><span>гостей, до</span></div>
        </div>

        {settings.features.length > 0 && (
          <div className="pub-chips">
            {settings.features.map((f) => (
              <span key={f} className="pub-chip">{f}</span>
            ))}
          </div>
        )}

        {settings.promos.length > 0 && (
          <>
            <h2 className="pub-h2">Акции</h2>
            {settings.promos.map((p) => (
              <div key={p.title} className="pub-promo">
                <b><Sparkles size={14} style={{ display: 'inline', marginRight: 6 }} />{p.title}</b>
                <span className="pub-muted">{p.text}</span>
              </div>
            ))}
          </>
        )}

        <h2 className="pub-h2">Залы</h2>
        {loading && <div className="spinner" style={{ margin: '20px auto' }} />}
        {halls.map((h) => {
          const happy = settings.happy.enabled && (h.price_happy || 0) > 0
          return (
            <div key={h.id} className="pub-card">
              <div className="pub-row" style={{ alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 18 }}>{h.name}</div>
                  <div className="pub-muted" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <Users size={14} /> до {h.capacity} гостей · от {h.min_hours || 1} ч
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="pub-price">{rub(h.price_per_hour)}<span style={{ fontSize: 12, fontWeight: 600 }}> /час</span></div>
                  {happy && (
                    <div style={{ fontSize: 12, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end' }}>
                      <Flame size={12} /> {rub(h.price_happy as number)} в счастливые часы
                    </div>
                  )}
                </div>
              </div>
              {h.description && <p className="pub-muted" style={{ marginTop: 10 }}>{h.description}</p>}
              {h.features && (
                <div className="pub-chips" style={{ marginTop: 10 }}>
                  {h.features.split(',').map((f) => f.trim()).filter(Boolean).map((f) => (
                    <span key={f} className="pub-chip">{f}</span>
                  ))}
                </div>
              )}
              <p className="pub-muted" style={{ fontSize: 12, marginTop: 10 }}>
                В цену включено {h.included_guests} гостей{h.extra_guest_price ? `, далее +${rub(h.extra_guest_price)} за гостя в час` : ''}
              </p>
              <Link to={`/s/${slug}/book?hall=${h.id}`} className="pub-btn" style={{ marginTop: 12 }}>
                Выбрать время <ArrowUpRight size={16} />
              </Link>
            </div>
          )
        })}
        {!loading && halls.length === 0 && <div className="pub-card pub-muted" style={{ textAlign: 'center' }}>Залы скоро появятся</div>}
        {offline && <p className="pub-muted" style={{ fontSize: 12 }}>Демо-данные: сервер бронирования недоступен{phone ? ` — позвоните ${phone}` : ''}.</p>}

        {extras.length > 0 && (
          <>
            <h2 className="pub-h2">Веники, полотенца и допуслуги</h2>
            <div className="pub-card">
              {extras.map((x, i) => (
                <div key={x.id} className="pub-row" style={{ padding: '9px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
                  <span>{x.name}</span>
                  <span className="pub-muted">{x.price > 0 ? `${rub(x.price)} ${UNIT_RU[x.unit]}` : 'по запросу'}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <h2 className="pub-h2">Фото</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cards.map((c) => (
            <div key={c.id} className="pub-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ height: 190, overflow: 'hidden', background: '#0a0604', position: 'relative' }}>
                <img src={c.image} alt={c.title} style={{ ...cropTransform({ scale: c.scale ?? 1, x: c.x ?? 0, y: c.y ?? 0 }), width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              {c.title && <div className="pub-muted" style={{ padding: '10px 14px' }}>{c.title}</div>}
            </div>
          ))}
        </div>

        <h2 className="pub-h2">Как нас найти</h2>
        <div className="pub-card">
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}><MapPin size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} /><b>{address}</b></div>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}><Clock size={18} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} /><b>{workLabel(settings)}</b></div>
          <div style={{ display: 'flex', gap: 10 }}>
            <a href={route} target="_blank" rel="noopener noreferrer" className="pub-btn ghost">Маршрут <ArrowUpRight size={15} /></a>
            {phone && (
              <a href={`tel:${phone}`} className="pub-btn" style={{ width: 52, flexShrink: 0, padding: 0, height: 52 }} aria-label="Позвонить"><Phone size={19} /></a>
            )}
          </div>
          {settings.site && (
            <a href={settings.site} target="_blank" rel="noopener noreferrer" className="pub-muted" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14 }}>
              <ExternalLink size={14} /> {settings.site.replace(/^https?:\/\//, '')}
            </a>
          )}
        </div>
      </div>

      <BottomNavigation slug={slug} active="home" />
    </div>
  )
}
