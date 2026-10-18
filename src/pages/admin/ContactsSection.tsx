import { useState } from 'react'
import { pb } from '../../lib/pb'
import { normalizeSettings } from '../../lib/studioSettings'
import { Sheet, Field, errText } from './ui'
import { patchSettings, type SectionProps } from './types'

export default function ContactsSection({ studio, onClose, onChanged, notify }: SectionProps) {
  const [name, setName] = useState(studio.name || '')
  const [phone, setPhone] = useState(studio.phone || '')
  const [address, setAddress] = useState(studio.address || '')
  const [description, setDescription] = useState(studio.description || '')
  const [site, setSite] = useState(normalizeSettings(studio.settings).site)
  const [busy, setBusy] = useState(false)

  async function save() {
    if (!name.trim()) return notify('Укажите название', true)
    setBusy(true)
    try {
      await pb.collection('studios').update(studio.id, {
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
        description: description.trim(),
      })
      await patchSettings(pb.collection('studios'), { ...studio, settings: studio.settings }, { site: site.trim() })
      await onChanged()
      notify('Контакты сохранены')
    } catch (e) {
      notify(errText(e), true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet title="Контакты" onClose={onClose}>
      <div className="adm-glass adm-card">
        <Field label="Название студии">
          <input className="adm-input" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Телефон">
          <input className="adm-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7 812 000-00-00" />
        </Field>
        <Field label="Адрес">
          <input className="adm-input" value={address} onChange={(e) => setAddress(e.target.value)} />
        </Field>
        <Field label="Сайт">
          <input className="adm-input" type="url" value={site} onChange={(e) => setSite(e.target.value)} placeholder="https://" />
        </Field>
        <Field label="Описание на главной">
          <textarea className="adm-input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <button type="button" className="adm-pill adm-primary" style={{ width: '100%' }} disabled={busy} onClick={() => void save()}>
          {busy ? 'Сохраняю…' : 'Сохранить'}
        </button>
      </div>
    </Sheet>
  )
}
