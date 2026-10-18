import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import StudioPage from './pages/StudioPage'
import BookingPage from './pages/BookingPage'
import SuccessPage from './pages/SuccessPage'
import MinePage from './pages/MinePage'
import AdminPage from './pages/AdminPage'
import AiAssistant from './components/AiAssistant'

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/s/:slug" element={<StudioPage />} />
        <Route path="/s/:slug/book" element={<BookingPage />} />
        <Route path="/s/:slug/success" element={<SuccessPage />} />
        <Route path="/s/:slug/mine" element={<MinePage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
      <AiAssistant />
    </>
  )
}
