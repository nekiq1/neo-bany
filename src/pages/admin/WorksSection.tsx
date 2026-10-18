import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, ImagePlus, Trash2 } from 'lucide-react'
import { pb } from '../../lib/pb'
import { optimizeImageToFile } from '../../lib/optimizeImage'
import { ImageCropEditor } from '../../components/ImageCropEditor'
import { fetchWorks, fileUrl, type WorkRecord } from '../../lib/studioSettings'
import { Sheet, Field, errText } from './ui'
import type { SectionProps } from './types'

/**
 * mode="upload"  — «Работы»: загрузка фото (можно сразу несколько) и удаление
 * mode="cards"   — «Карточки витрины»: подписи, зум/сдвиг кадра, порядок
 */
export default function WorksSection({ studio, mode, onClose, notify }: SectionProps & { mode: 'upload' | 'cards' }) {
  const [works, setWorks] = useState<WorkRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setWorks(await fetchWorks())
    setDirty(new Set())
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function patch(id: string, p: Partial<WorkRecord>) {
    setWorks((list) => list.map((w) => (w.id === id ? { ...w, ...p } : w)))
    setDirty((d) => new Set(d).add(id))
  }

  async function upload(files: FileList) {
    setBusy(true)
    try {
      let order = works.length
      for (const file of Array.from(files)) {
        const img = await optimizeImageToFile(file, { maxSide: 1600, quality: 0.82 })
        await pb.collection('works').create({
          studio_id: studio.id,
          title: '',
          image: img,
          sort_order: ++order,
          scale: 1,
          x: 0,
          y: 0,
        })
      }
      await load()
      notify('Фото загружены')
    } catch (e) {
      notify(errText(e), true)
    } finally {
      setBusy(false)
    }
  }

  async function remove(w: WorkRecord) {
    if (!window.confirm('Удалить это фото?')) return
    try {
      await pb.collection('works').delete(w.id)
      await load()
      notify('Удалено')
    } catch (e) {
      notify(errText(e), true)
    }
  }

  async function move(idx: number, dir: -1 | 1) {
    const j = idx + dir
    if (j < 0 || j >= works.length) return
    const a = works[idx]
    const b = works[j]
    try {
      await pb.collection('works').update(a.id, { sort_order: j + 1 })
      await pb.collection('works').update(b.id, { sort_order: idx + 1 })
      await load()
    } catch (e) {
      notify(errText(e), true)
    }
  }

  async function saveAll() {
    setBusy(true)
    try {
      for (const w of works.filter((x) => dirty.has(x.id))) {
        await pb.collection('works').update(w.id, { title: w.title || '', scale: w.scale || 1, x: w.x || 0, y: w.y || 0 })
      }
      await load()
      notify('Витрина сохранена')
    } catch (e) {
      notify(errText(e), true)
    } finally {
      setBusy(false)
    }
  }

  const uploader = (
    <label className="adm-upload" style={{ marginBottom: 14 }}>
      <ImagePlus size={18} />
      {busy ? 'Загружаю…' : 'Загрузить фото'}
      <input
        type="file"
        accept="image/*"
        multiple
        hidden
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files
          if (f && f.length) void upload(f)
          e.target.value = ''
        }}
      />
    </label>
  )

  return (
    <Sheet title={mode === 'upload' ? 'Работы' : 'Карточки витрины'} onClose={onClose}>
      {mode === 'upload' && uploader}
      {loading && <div className="spinner" style={{ margin: '24px auto' }} />}
      {!loading && works.length === 0 && (
        <div className="adm-glass adm-card" style={{ textAlign: 'center', color: '#8b95a8' }}>
          Своих работ пока нет — на сайте показаны стандартные фото. Загрузите первые во вкладке «Работы».
        </div>
      )}

      {mode === 'upload' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {works.map((w) => (
            <div key={w.id} style={{ position: 'relative' }}>
              <img src={fileUrl(w, w.image)} alt={w.title} className="adm-thumb" style={{ height: 120 }} />
              <button
                type="button"
                className="adm-icon-btn"
                style={{ position: 'absolute', top: 6, right: 6, width: 34, height: 34, background: 'rgba(0,0,0,0.6)' }}
                onClick={() => void remove(w)}
                aria-label="Удалить"
              >
                <Trash2 size={15} color="#ff6b6b" />
              </button>
            </div>
          ))}
        </div>
      )}

      {mode === 'cards' &&
        works.map((w, idx) => (
          <div key={w.id} className="adm-glass adm-card">
            <ImageCropEditor
              src={fileUrl(w, w.image)}
              height={170}
              value={{ scale: w.scale || 1, x: w.x || 0, y: w.y || 0 }}
              onChange={(v) => patch(w.id, { scale: v.scale, x: v.x, y: v.y })}
            />
            <Field label="Подпись">
              <input className="adm-input" value={w.title || ''} onChange={(e) => patch(w.id, { title: e.target.value })} />
            </Field>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="adm-icon-btn" disabled={idx === 0} onClick={() => void move(idx, -1)} aria-label="Выше">
                <ArrowUp size={18} />
              </button>
              <button type="button" className="adm-icon-btn" disabled={idx === works.length - 1} onClick={() => void move(idx, 1)} aria-label="Ниже">
                <ArrowDown size={18} />
              </button>
              <button type="button" className="adm-pill adm-danger" style={{ flex: 1, padding: 11, fontSize: 13 }} onClick={() => void remove(w)}>
                <Trash2 size={15} /> Удалить
              </button>
            </div>
          </div>
        ))}

      {mode === 'cards' && works.length > 0 && (
        <button type="button" className="adm-pill adm-primary" style={{ width: '100%' }} disabled={busy || dirty.size === 0} onClick={() => void saveAll()}>
          {busy ? 'Сохраняю…' : dirty.size ? `Сохранить изменения (${dirty.size})` : 'Нет изменений'}
        </button>
      )}
    </Sheet>
  )
}
