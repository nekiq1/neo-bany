import { Navigate } from 'react-router-dom'
import { DEFAULT_SLUG } from '../lib/studioSettings'

export default function HomePage() {
  return <Navigate to={`/s/${DEFAULT_SLUG}`} replace />
}
