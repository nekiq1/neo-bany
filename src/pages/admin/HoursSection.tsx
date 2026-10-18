import { useState } from 'react'
import { pb } from '../../lib/pb'
import { normalizeSettings, workLabel } from '../../lib/studioSettings'
import { Sheet, Field, errText } from './ui'
import { patchSettings, type SectionProps } from './types'

const DAYS = [
  [1, 'Пн'], [2, 'Вт'], [3, 'Ср'], [4, 'Чт'], [5, 'Пт'], [6, 'Сб'], [7, 'Вс'],
] as const

export default function HoursSection({ studio, onClose, onChanged, notify }: SectionProps) {
  const s = normalizeSettings(studio.settings)
  const [open24, setOpen24] = useState(s.open24)
  const [start, setStart] = useState(s.workStart)
  const [end, setEnd] = useState(s.workEnd)
  const [maxHours, setMaxHours] = useState(s.maxHours)
  const [cleanup, setCleanup] = useState(s.cleanupMinutes)
  const [lead, setLead] = useState(s.leadMinutes)
  const [hEnabled, setHEnabled] = useState(s.happy.enabled)
  const [hFrom, setHFrom] = useState(s.happy.from)
  const [hTo, setHTo] = useState(s.happy.to)
  const [hDays, setHDays] = useState<number[]>(s.happy.days)
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!open24 && end <= start) return notify('Конец работы должен быть позже начала', true)
    if (hEnabled && hTo <= hFrom) return notify('Счастливые часы: конец должен быть позже начала', true)
    setBusy(true)
    try {
      await patchSettings(pb.collection('studios'), studio, {
        open24, workStart: start, workEnd: end, maxHours, cleanupMinutes: cleanup, leadMinutes: lead,
        happy: { enabled: hEnabled, from: hFrom, to: hTo, days: hDays },
      })
      await onChanged()
      notify('Сохранено')
    } catch (e) {
      notify(errText(e), true)
    } finally {
      setBusy(false)
    }
  }

  const hours = Array.from({ length: 24 }, (_, h) => h)
  const hoursTo = Array.from({ length: 24 }, (_, h) => h + 1)
  const fmt = (h: number) => `${String(h % 24).padStart(2, '0')}:00`

  return (
    <Sheet title="Часы работы" onClose={onClose}>
      <div className="adm-glass adm-card">
        <p className="adm-sub" style={{ marginBottom: 14 }}>Сейчас: {workLabel(s)}</p>
        <label className="adm-switch" style={{ marginBottom: 14 }}>
          Круглосуточно
          <input type="checkbox" checked={open24} onChange={(e) => setOpen24(e.target.checked)} />
        </label>
        {!open24 && (
          <div className="adm-row">
            <Field label="Открытие">
              <select className="adm-input" value={start} onChange={(e) => setStart(Number(e.target.value))}>
                {hours.map((h) => <option key={h} value={h}>{fmt(h)}</option>)}
              </select>
            </Field>
            <Field label="Закрытие">
              <select className="adm-input" value={end} onChange={(e) => setEnd(Number(e.target.value))}>
                {hoursTo.map((h) => <option key={h} value={h}>{fmt(h)}</option>)}
              </select>
            </Field>
          </div>
        )}
        <div className="adm-row">
          <Field label="Макс. часов в брони">
            <input className="adm-input" type="number" min={1} max={24} value={maxHours} onChange={(e) => setMaxHours(Math.max(1, Math.min(24, Number(e.target.value) || 1)))} />
          </Field>
          <Field label="Уборка между, мин">
            <input className="adm-input" type="number" min={0} max={240} step={5} value={cleanup} onChange={(e) => setCleanup(Math.max(0, Number(e.target.value) || 0))} />
          </Field>
        </div>
        <Field label="Закрыть онлайн-бронь за, мин до начала">
          <input className="adm-input" type="number" min={0} max={1440} step={15} value={lead} onChange={(e) => setLead(Math.max(0, Number(e.target.value) || 0))} />
        </Field>
      </div>

      <div className="adm-glass adm-card">
        <label className="adm-switch" style={{ marginBottom: 6 }}>
          Счастливые часы
          <input type="checkbox" checked={hEnabled} onChange={(e) => setHEnabled(e.target.checked)} />
        </label>
        <p className="adm-sub" style={{ marginBottom: 14 }}>
          В эти часы действует сниженная цена зала («Цена в счастливые часы» в карточке зала).
        </p>
        {hEnabled && (
          <>
            <div className="adm-row">
              <Field label="С">
                <select className="adm-input" value={hFrom} onChange={(e) => setHFrom(Number(e.target.value))}>
                  {hours.map((h) => <option key={h} value={h}>{fmt(h)}</option>)}
                </select>
              </Field>
              <Field label="До">
                <select className="adm-input" value={hTo} onChange={(e) => setHTo(Number(e.target.value))}>
                  {hoursTo.map((h) => <option key={h} value={h}>{fmt(h)}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              {DAYS.map(([n, l]) => (
                <button
                  key={n}
                  type="button"
                  className={`adm-pill${hDays.includes(n) ? ' on' : ''}`}
                  style={{ flex: 1, padding: '10px 0', fontSize: 13 }}
                  onClick={() => setHDays((d) => (d.includes(n) ? d.filter((x) => x !== n) : [...d, n]))}
                >
                  {l}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <button type="button" className="adm-pill adm-primary" style={{ width: '100%' }} disabled={busy} onClick={() => void save()}>
        {busy ? 'Сохраняю…' : 'Сохранить'}
      </button>
    </Sheet>
  )
}
