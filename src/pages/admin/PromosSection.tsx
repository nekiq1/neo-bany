import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { pb } from '../../lib/pb'
import { normalizeSettings, type Promo } from '../../lib/studioSettings'
import { Sheet, Field, errText } from './ui'
import { patchSettings, type SectionProps } from './types'

/** Акции и список удобств, которые показываются на главной */
export default function PromosSection({ studio, onClose, onChanged, notify }: SectionProps) {
  const s = normalizeSettings(studio.settings)
  const [promos, setPromos] = useState<Promo[]>(s.promos)
  const [features, setFeatures] = useState(s.features.join(', '))
  const [busy, setBusy] = useState(false)

  const setP = (i: number, p: Partial<Promo>) => setPromos((l) => l.map((x, k) => (k === i ? { ...x, ...p } : x)))

  async function save() {
    setBusy(true)
    try {
      await patchSettings(pb.collection('studios'), studio, {
        promos: promos.filter((p) => p.title.trim()).map((p) => ({ title: p.title.trim(), text: p.text.trim() })),
        features: features.split(',').map((f) => f.trim()).filter(Boolean),
      })
      await onChanged()
      notify('Сохранено')
    } catch (e) {
      notify(errText(e), true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="Акции" onClose={onClose}>
      {promos.map((p, i) => (
        <div key={i} className="adm-glass adm-card">
          <Field label="Название">
            <input className="adm-input" value={p.title} onChange={(e) => setP(i, { title: e.target.value })} placeholder="Счастливые часы" />
          </Field>
          <Field label="Условия">
            <textarea className="adm-input" rows={2} value={p.text} onChange={(e) => setP(i, { text: e.target.value })} />
          </Field>
          <button type="button" className="adm-pill adm-danger" style={{ width: '100%', padding: 11, fontSize: 13 }} onClick={() => setPromos((l) => l.filter((_, k) => k !== i))}>
            <Trash2 size={15} /> Удалить акцию
          </button>
        </div>
      ))}
      <button type="button" className="adm-pill" style={{ width: '100%', marginBottom: 14 }} onClick={() => setPromos((l) => [...l, { title: '', text: '' }])}>
        <Plus size={17} /> Добавить акцию
      </button>

      <div className="adm-glass adm-card">
        <Field label="Удобства на главной (через запятую)">
          <textarea className="adm-input" rows={3} value={features} onChange={(e) => setFeatures(e.target.value)} placeholder="Бассейн, Караоке, Wi‑Fi, Парковка" />
        </Field>
      </div>
      <button type="button" className="adm-pill adm-primary" style={{ width: '100%' }} disabled={busy} onClick={() => void save()}>
        {busy ? 'Сохраняю…' : 'Сохранить'}
      </button>
    </Sheet>
  )
}
