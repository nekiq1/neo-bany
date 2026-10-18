import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Phone } from 'lucide-react'
import { AppHeader, BottomNavigation } from '../components/AppChrome'
import { useStudioConfig, DEFAULT_SLUG } from '../lib/studioSettings'
import { rub } from '../lib/pricing'

type Saved = { name?: string; hall?: string; when?: string; total?: number; guests?: number }

/** Последняя бронь с этого устройства. Изменить или отменить — через администратора. */
export default function MinePage() {
  const { slug = DEFAULT_SLUG } = useParams<{ slug: string }>()
  const { config } = useStudioConfig(slug)
  const [b, setB] = useState<Saved | null>(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('banya-booking')
      setB(raw ? (JSON.parse(raw) as Saved) : null)
    } catch {
      setB(null)
    }
  }, [])

  const phone = config.studio?.phone
  return (
    <div className="pub fade-in">
      <AppHeader slug={slug} />
      <div className="container">
        <h1 className="pub-h1" style={{ marginTop: 8 }}>Моя бронь</h1>
        {b ? (
          <div className="pub-card">
            <div className="pub-muted" style={{ marginBottom: 6 }}>Последняя заявка с этого устройства</div>
            <div style={{ fontWeight: 800, fontSize: 19 }}>{b.hall}</div>
            <div style={{ marginTop: 4 }}>{b.when}</div>
            <div className="pub-muted" style={{ marginTop: 6 }}>
              {b.name}{b.guests ? ` · ${b.guests} гостей` : ''}{b.total ? ` · ${rub(b.total)}` : ''}
            </div>
            <p className="pub-muted" style={{ fontSize: 12, marginTop: 12 }}>Чтобы изменить или отменить бронь, позвоните администратору.</p>
            {phone && <a href={`tel:${phone}`} className="pub-btn" style={{ marginTop: 12 }}><Phone size={16} /> {phone}</a>}
          </div>
        ) : (
          <div className="pub-card" style={{ textAlign: 'center' }}>
            <p className="pub-muted">Здесь появится ваша бронь после оформления.</p>
            <Link to={`/s/${slug}/book`} className="pub-btn" style={{ marginTop: 14 }}>Забронировать</Link>
          </div>
        )}
      </div>
      <BottomNavigation slug={slug} active="mine" />
    </div>
  )
}
