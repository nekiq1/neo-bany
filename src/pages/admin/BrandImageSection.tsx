import { useState } from 'react'
import { ImagePlus, Trash2 } from 'lucide-react'
import { pb } from '../../lib/pb'
import { optimizeImageToFile } from '../../lib/optimizeImage'
import { fileUrl, normalizeSettings, DEFAULT_HERO, DEFAULT_LOGO } from '../../lib/studioSettings'
import { ImageCropEditor } from '../../components/ImageCropEditor'
import { Sheet, errText } from './ui'
import { patchSettings, type SectionProps } from './types'

/** Логотип (kind="logo") и главное фото (kind="hero", с кадрированием) */
export default function BrandImageSection({
  studio,
  kind,
  onClose,
  onChanged,
  notify,
}: SectionProps & { kind: 'logo' | 'hero' }) {
  const field = kind
  const current = studio[field] ? fileUrl(studio, studio[field]) : ''
  const fallback = kind === 'logo' ? DEFAULT_LOGO : DEFAULT_HERO
  const s = normalizeSettings(studio.settings)
  const [crop, setCrop] = useState({ scale: s.heroScale, x: s.heroX, y: s.heroY })
  const [busy, setBusy] = useState(false)

  async function upload(file: File) {
    setBusy(true)
    try {
      const optimized = await optimizeImageToFile(file, {
        maxSide: kind === 'logo' ? 600 : 1800,
        quality: 0.85,
      })
      await pb.collection('studios').update(studio.id, { [field]: optimized })
      if (kind === 'hero') await patchSettings(pb.collection('studios'), studio, { heroScale: 1, heroX: 0, heroY: 0 })
      setCrop({ scale: 1, x: 0, y: 0 })
      await onChanged()
      notify('Фото обновлено')
    } catch (e) {
      notify(errText(e), true)
    } finally {
      setBusy(false)
    }
  }

  async function reset() {
    if (!window.confirm('Вернуть стандартное изображение?')) return
    setBusy(true)
    try {
      await pb.collection('studios').update(studio.id, { [field]: null })
      await onChanged()
      notify('Сброшено')
    } catch (e) {
      notify(errText(e), true)
    } finally {
      setBusy(false)
    }
  }

  async function saveCrop() {
    setBusy(true)
    try {
      await patchSettings(pb.collection('studios'), studio, { heroScale: crop.scale, heroX: crop.x, heroY: crop.y })
      await onChanged()
      notify('Кадр сохранён')
    } catch (e) {
      notify(errText(e), true)
    } finally {
      setBusy(false)
    }
  }

  const src = current || fallback
  return (
    <Sheet title={kind === 'logo' ? 'Логотип' : 'Главное фото'} onClose={onClose}>
      <div className="adm-glass adm-card">
        {kind === 'hero' ? (
          <ImageCropEditor src={src} height={240} label="Зум — щипок или колесо, сдвиг — перетаскивание" value={crop} onChange={setCrop} />
        ) : (
          <img src={src} alt="Логотип" className="adm-thumb" style={{ height: 160, objectFit: 'contain' }} />
        )}
        <label className="adm-upload" style={{ marginTop: 14 }}>
          <ImagePlus size={18} />
          {busy ? 'Загружаю…' : 'Загрузить новое фото'}
          <input
            type="file"
            accept="image/*"
            hidden
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void upload(f)
            }}
          />
        </label>
        {kind === 'hero' && (
          <button type="button" className="adm-pill adm-primary" style={{ width: '100%', marginTop: 10 }} disabled={busy} onClick={() => void saveCrop()}>
            Сохранить кадр
          </button>
        )}
        {current && (
          <button type="button" className="adm-pill adm-danger" style={{ width: '100%', marginTop: 10 }} disabled={busy} onClick={() => void reset()}>
            <Trash2 size={16} /> Вернуть стандартное
          </button>
        )}
      </div>
    </Sheet>
  )
}
