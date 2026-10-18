import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { pb } from '../../lib/pb'
import { normalizeSettings } from '../../lib/studioSettings'
import { computePrice, rub } from '../../lib/pricing'
import { HOUR, fromView } from '../../lib/tz'
import type { Hall } from '../../types'
import { Sheet, Field, errText } from './ui'
import { BLOCK_PHONE, type SectionProps } from './types'

/** Ручная бронь (звонок, мессенджер) или блокировка времени */
export default function AddBookingSheet({
  studio, defaultDate, onClose, onChanged, notify,
}: SectionProps & { defaultDate: Date }) {
  const settings = normalizeSettings(studio.settings)
  const [halls, setHalls] = useState<Hall[]>([])
  const [hallId, setHallId] = useState('')
  const [date, setDate] = useState(format(defaultDate, 'yyyy-MM-dd'))
  const [time, setTime] = useState('18:00')
  const [hours, setHours] = useState(2)
  const [guests, setGuests] = useState(2)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<'pending' | 'confirmed'>('confirmed')
  const [totalStr, setTotalStr] = useState('')
  const [block, setBlock] = useState(false)
  const [allHalls, setAllHalls] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void pb.collection('halls').getFullList<Hall>({ filter: `studio_id="${studio.id}"`, sort: 'sort_order,created' })
      .then((l) => { setHalls(l); if (l[0]) { setHallId(l[0].id); setHours(Math.max(2, l[0].min_hours || 1)) } })
      .catch(() => undefined)
  }, [studio.id])

  // дата/время вводятся в часовом поясе студии
  const [hh, mm] = time.split(':').map(Number)
  const [Y, M, D] = date.split('-').map(Number)
  const startMs = Number.isFinite(Y) && Number.isFinite(hh) ? fromView(new Date(Y, M - 1, D, hh, mm || 0), settings.tzOffsetMin) : NaN

  const hall = halls.find((h) => h.id === hallId)
  const auto = hall && Number.isFinite(startMs) ? computePrice(hall, settings, startMs, hours, guests, []).total : 0
  const total = totalStr === '' ? auto : Number(totalStr) || 0

  async function save() {
    if (!Number.isFinite(startMs)) return notify('Неверная дата или время', true)
    if (hours < 1) return notify('Минимум 1 час', true)
    if (!block && (!hall || !name.trim() || !phone.trim())) return notify('Выберите зал, укажите имя и телефон', true)
    if (block && !allHalls && !hall) return notify('Выберите зал', true)
    setBusy(true)
    try {
      await pb.collection('bookings').create({
        studio_id: studio.id,
        studio_slug: studio.slug,
        hall_id: block && allHalls ? '' : hallId,
        hall_name: block ? (allHalls ? 'Все залы' : hall?.name || '') : hall?.name || '',
        customer_name: block ? 'Блокировка времени' : name.trim(),
        customer_phone: block ? BLOCK_PHONE : phone.trim(),
        guests: block ? 0 : guests,
        hours,
        start_at: new Date(startMs).toISOString(),
        end_at: new Date(startMs + hours * HOUR).toISOString(),
        extras: [],
        total: block ? 0 : total,
        paid: false,
        notes: notes.trim(),
        status: block ? 'confirmed' : status,
      })
      await onChanged()
      notify(block ? 'Время заблокировано' : 'Бронь добавлена')
      onClose()
    } catch (e) {
      notify(errText(e), true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="Новая бронь" onClose={onClose}>
      <div className="adm-glass adm-card">
        <label className="adm-switch" style={{ marginBottom: 14 }}>
          Заблокировать время (ремонт, уборка, выходной)
          <input type="checkbox" checked={block} onChange={(e) => setBlock(e.target.checked)} />
        </label>
        {block && (
          <label className="adm-switch" style={{ marginBottom: 14 }}>
            Для всех залов
            <input type="checkbox" checked={allHalls} onChange={(e) => setAllHalls(e.target.checked)} />
          </label>
        )}
        {(!block || !allHalls) && (
          <Field label="Зал">
            <select className="adm-input" value={hallId} onChange={(e) => setHallId(e.target.value)}>
              {halls.length === 0 && <option value="">Нет залов — добавьте в «Услуги»</option>}
              {halls.map((h) => <option key={h.id} value={h.id}>{h.name} — {rub(h.price_per_hour)}/ч</option>)}
            </select>
          </Field>
        )}
        <div className="adm-row">
          <Field label="Дата"><input className="adm-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Начало"><input className="adm-input" type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} /></Field>
        </div>
        <div className="adm-row">
          <Field label="Часов"><input className="adm-input" type="number" min={1} max={24} value={hours} onChange={(e) => setHours(Math.max(1, Math.min(24, Number(e.target.value) || 1)))} /></Field>
          {!block && <Field label="Гостей"><input className="adm-input" type="number" min={1} value={guests} onChange={(e) => setGuests(Math.max(1, Number(e.target.value) || 1))} /></Field>}
        </div>
        {!block && (
          <>
            <Field label="Имя клиента"><input className="adm-input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label="Телефон"><input className="adm-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
            <Field label={`Сумма, ₽ (расчёт: ${rub(auto)})`}>
              <input className="adm-input" type="number" min={0} inputMode="numeric" value={totalStr} placeholder={String(auto)} onChange={(e) => setTotalStr(e.target.value)} />
            </Field>
            <Field label="Статус">
              <select className="adm-input" value={status} onChange={(e) => setStatus(e.target.value as 'pending' | 'confirmed')}>
                <option value="confirmed">Подтверждена</option>
                <option value="pending">Новая</option>
              </select>
            </Field>
          </>
        )}
        <Field label="Заметка"><textarea className="adm-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Веники, день рождения…" /></Field>
        <button type="button" className="adm-pill adm-primary" style={{ width: '100%' }} disabled={busy} onClick={() => void save()}>
          {busy ? 'Сохраняю…' : block ? 'Заблокировать' : 'Добавить бронь'}
        </button>
      </div>
    </Sheet>
  )
}
