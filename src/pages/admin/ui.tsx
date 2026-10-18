import { useEffect, type ReactNode } from 'react'
import { ChevronLeft } from 'lucide-react'

/** Полноэкранный подраздел админки с кнопкой «Назад» */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])
  return (
    <div className="adm-sheet">
      <div className="adm-wrap" style={{ paddingBottom: 60 }}>
        <div className="adm-sheet-head">
          <button type="button" className="adm-icon-btn" onClick={onClose} aria-label="Назад">
            <ChevronLeft size={22} />
          </button>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>{title}</h2>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="adm-field">
      <label className="adm-label">{label}</label>
      {children}
    </div>
  )
}

export function Toast({ msg, error }: { msg: string | null; error?: boolean }) {
  if (!msg) return null
  return <div className={`adm-toast${error ? ' err' : ''}`}>{msg}</div>
}

export const STATUS_RU: Record<string, string> = {
  pending: 'Новая',
  confirmed: 'Подтверждена',
  completed: 'Выполнена',
  cancelled: 'Отменена',
}

export function errText(e: unknown): string {
  const x = e as { message?: string; response?: { message?: string } }
  return x?.response?.message || x?.message || 'Ошибка'
}
