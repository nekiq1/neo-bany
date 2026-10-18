import { CalendarCheck, Home, Flame, Phone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useStudioConfig, DEFAULT_SLUG } from '../lib/studioSettings'

type ActiveTab = 'home' | 'book' | 'mine' | 'none'

export function AppHeader({ slug = DEFAULT_SLUG }: { slug?: string; phone?: string }) {
  const { config } = useStudioConfig(slug)
  const phone = config.studio?.phone
  return (
    <header className="app-header">
      <Link to={`/s/${slug}`} className="app-brand" aria-label="На главную">
        <img src={config.logoUrl} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 10, background: '#14100b' }} />
        <span>{config.studio?.name || 'Капля'}</span>
      </Link>
      {phone && (
        <a className="app-header-phone" href={`tel:${phone}`} aria-label="Позвонить">
          <Phone size={17} />
        </a>
      )}
    </header>
  )
}

export function BottomNavigation({ slug = DEFAULT_SLUG, active = 'none' }: { slug?: string; active?: ActiveTab }) {
  return (
    <nav className="bottom-nav" aria-label="Основная навигация">
      <Link to={`/s/${slug}`} className={active === 'home' ? 'active' : ''}>
        <Home size={19} />
        <span>Главная</span>
      </Link>
      <Link to={`/s/${slug}/book`} className={active === 'book' ? 'active' : ''}>
        <Flame size={19} />
        <span>Бронь</span>
      </Link>
      <Link to={`/s/${slug}/mine`} className={active === 'mine' ? 'active' : ''}>
        <CalendarCheck size={19} />
        <span>Моя бронь</span>
      </Link>
    </nav>
  )
}
