import { Check } from 'lucide-react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AppHeader, BottomNavigation } from '../components/AppChrome'
import { useStudioConfig, DEFAULT_SLUG } from '../lib/studioSettings'
import { rub } from '../lib/pricing'

export default function SuccessPage() {
  const { slug = DEFAULT_SLUG } = useParams<{ slug: string }>()
  const [q] = useSearchParams()
  const { config } = useStudioConfig(slug)
  const phone = config.studio?.phone
  const name = q.get('name') || ''
  const hall = q.get('hall') || ''
  const time = q.get('time') || ''
  const total = Number(q.get('total')) || 0

  return (
    <div className="pub fade-in">
      <AppHeader slug={slug} />
      <main className="container" style={{ minHeight: '68dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <span style={{ width: 68, height: 68, display: 'grid', placeItems: 'center', borderRadius: '50%', background: 'var(--accent)', color: '#1a0f05' }}>
          <Check size={34} />
        </span>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginTop: 20 }}>Заявка принята</h1>
        <p className="pub-muted" style={{ maxWidth: 330, marginTop: 12, lineHeight: 1.6 }}>
          {name ? `${name}, ` : ''}{hall && `${hall}. `}{time && `${time}.`}
        </p>
        {total > 0 && <p style={{ fontWeight: 800, fontSize: 20, marginTop: 8 }}>{rub(total)}</p>}
        <p className="pub-muted" style={{ maxWidth: 330, fontSize: 13, marginTop: 10 }}>
          Администратор свяжется с вами для подтверждения. Оплата — на месте.
        </p>
        <div style={{ display: 'grid', gap: 10, width: '100%', maxWidth: 320, marginTop: 26 }}>
          {phone && <a href={`tel:${phone}`} className="pub-btn">Позвонить администратору</a>}
          <Link to={`/s/${slug}`} className="pub-btn ghost">На главную</Link>
        </div>
      </main>
      <BottomNavigation slug={slug} />
    </div>
  )
}
