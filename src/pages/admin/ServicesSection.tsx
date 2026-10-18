import { useCallback, useEffect, useState } from 'react'
import { ImagePlus, Plus, Trash2 } from 'lucide-react'
import { pb } from '../../lib/pb'
import { optimizeImageToFile } from '../../lib/optimizeImage'
import { fileUrl } from '../../lib/studioSettings'
import { rub } from '../../lib/pricing'
import { UNIT_RU, type Extra, type ExtraUnit, type Hall } from '../../types'
import { Sheet, Field, errText } from './ui'
import type { SectionProps } from './types'

type HallDraft = {
  id?: string; name: string; description: string; features: string; capacity: number; included_guests: number
  extra_guest_price: number; price_per_hour: number; price_happy: number; min_hours: number; sort_order: number
  is_active: boolean; photo?: string; collectionId?: string; collectionName?: string
}
type ExtraDraft = { id?: string; name: string; price: number; unit: ExtraUnit; sort_order: number; is_active: boolean }

const HALL0: HallDraft = {
  name: '', description: '', features: '', capacity: 8, included_guests: 4, extra_guest_price: 200,
  price_per_hour: 1900, price_happy: 0, min_hours: 2, sort_order: 0, is_active: true,
}
const EXTRA0: ExtraDraft = { name: '', price: 0, unit: 'item', sort_order: 0, is_active: true }

/** «Услуги»: залы (парные) и допуслуги (веники, полотенца, массаж…) */
export default function ServicesSection({ studio, onClose, notify }: SectionProps) {
  const [tab, setTab] = useState<'halls' | 'extras'>('halls')
  const [halls, setHalls] = useState<Hall[]>([])
  const [extras, setExtras] = useState<Extra[]>([])
  const [loading, setLoading] = useState(true)
  const [hall, setHall] = useState<HallDraft | null>(null)
  const [extra, setExtra] = useState<ExtraDraft | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const filter = `studio_id="${studio.id}"`
      const [h, x] = await Promise.all([
        pb.collection('halls').getFullList<Hall>({ filter, sort: 'sort_order,created' }),
        pb.collection('extras').getFullList<Extra>({ filter, sort: 'sort_order,created' }),
      ])
      setHalls(h)
      setExtras(x)
    } catch (e) {
      notify(errText(e), true)
    } finally {
      setLoading(false)
    }
  }, [studio.id, notify])

  useEffect(() => {
    void load()
  }, [load])

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true)
    try {
      await fn()
      await load()
      notify(ok)
    } catch (e) {
      notify(errText(e), true)
    } finally {
      setBusy(false)
    }
  }

  async function saveHall() {
    if (!hall) return
    if (!hall.name.trim()) return notify('Введите название зала', true)
    if (!(hall.price_per_hour > 0)) return notify('Укажите цену за час', true)
    if (hall.included_guests > hall.capacity) return notify('Гостей в цене не может быть больше вместимости', true)
    await run(async () => {
      const data = {
        studio_id: studio.id, name: hall.name.trim(), description: hall.description.trim(), features: hall.features.trim(),
        capacity: hall.capacity, included_guests: hall.included_guests, extra_guest_price: hall.extra_guest_price,
        price_per_hour: hall.price_per_hour, price_happy: hall.price_happy || 0, min_hours: Math.max(1, hall.min_hours),
        sort_order: hall.sort_order || halls.length + 1, is_active: hall.is_active,
      }
      if (hall.id) await pb.collection('halls').update(hall.id, data)
      else await pb.collection('halls').create(data)
      setHall(null)
    }, 'Зал сохранён')
  }

  async function uploadPhoto(file: File) {
    if (!hall?.id) return notify('Сначала сохраните зал, потом добавьте фото', true)
    await run(async () => {
      const img = await optimizeImageToFile(file, { maxSide: 1600, quality: 0.82 })
      const rec = await pb.collection('halls').update<Hall>(hall.id as string, { photo: img })
      setHall((h) => (h ? { ...h, photo: rec.photo } : h))
    }, 'Фото загружено')
  }

  async function saveExtra() {
    if (!extra) return
    if (!extra.name.trim()) return notify('Введите название', true)
    await run(async () => {
      const data = { studio_id: studio.id, name: extra.name.trim(), price: Math.max(0, extra.price), unit: extra.unit, sort_order: extra.sort_order || extras.length + 1, is_active: extra.is_active }
      if (extra.id) await pb.collection('extras').update(extra.id, data)
      else await pb.collection('extras').create(data)
      setExtra(null)
    }, 'Сохранено')
  }

  const del = (col: 'halls' | 'extras', id: string, name: string) => {
    if (!window.confirm(`Удалить «${name}»? Прошлые брони останутся.`)) return
    void run(() => pb.collection(col).delete(id).then(() => undefined), 'Удалено')
  }
  const toggle = (col: 'halls' | 'extras', id: string, v: boolean) =>
    void run(() => pb.collection(col).update(id, { is_active: !v }).then(() => undefined), v ? 'Скрыто с сайта' : 'Показано на сайте')

  // ---------- редактор зала ----------
  if (hall) {
    const set = (p: Partial<HallDraft>) => setHall((d) => (d ? { ...d, ...p } : d))
    const n = (v: string) => Number(v) || 0
    return (
      <Sheet title={hall.id ? 'Зал' : 'Новый зал'} onClose={() => setHall(null)}>
        <div className="adm-glass adm-card">
          <Field label="Название"><input className="adm-input" value={hall.name} onChange={(e) => set({ name: e.target.value })} /></Field>
          <Field label="Описание"><textarea className="adm-input" rows={3} value={hall.description} onChange={(e) => set({ description: e.target.value })} /></Field>
          <Field label="Особенности (через запятую)"><input className="adm-input" value={hall.features} onChange={(e) => set({ features: e.target.value })} placeholder="Бассейн, Караоке, Бильярд" /></Field>
          <div className="adm-row">
            <Field label="Цена за час, ₽"><input className="adm-input" type="number" min={0} inputMode="numeric" value={hall.price_per_hour} onChange={(e) => set({ price_per_hour: n(e.target.value) })} /></Field>
            <Field label="В счастливые часы, ₽"><input className="adm-input" type="number" min={0} inputMode="numeric" value={hall.price_happy} onChange={(e) => set({ price_happy: n(e.target.value) })} placeholder="0 — нет" /></Field>
          </div>
          <div className="adm-row">
            <Field label="Вместимость"><input className="adm-input" type="number" min={1} inputMode="numeric" value={hall.capacity} onChange={(e) => set({ capacity: n(e.target.value) })} /></Field>
            <Field label="Гостей в цене"><input className="adm-input" type="number" min={1} inputMode="numeric" value={hall.included_guests} onChange={(e) => set({ included_guests: n(e.target.value) })} /></Field>
          </div>
          <div className="adm-row">
            <Field label="Доп. гость, ₽/час"><input className="adm-input" type="number" min={0} inputMode="numeric" value={hall.extra_guest_price} onChange={(e) => set({ extra_guest_price: n(e.target.value) })} /></Field>
            <Field label="Минимум, часов"><input className="adm-input" type="number" min={1} inputMode="numeric" value={hall.min_hours} onChange={(e) => set({ min_hours: n(e.target.value) })} /></Field>
          </div>
          <Field label="Порядок"><input className="adm-input" type="number" value={hall.sort_order} onChange={(e) => set({ sort_order: n(e.target.value) })} /></Field>
          <label className="adm-switch" style={{ marginBottom: 14 }}>
            Показывать на сайте
            <input type="checkbox" checked={hall.is_active} onChange={(e) => set({ is_active: e.target.checked })} />
          </label>
          {hall.id && (
            <>
              {hall.photo && <img src={fileUrl({ id: hall.id, collectionId: hall.collectionId, collectionName: hall.collectionName }, hall.photo)} alt="" className="adm-thumb" style={{ height: 140, marginBottom: 10 }} />}
              <label className="adm-upload" style={{ marginBottom: 14 }}>
                <ImagePlus size={18} /> {hall.photo ? 'Заменить фото зала' : 'Добавить фото зала'}
                <input type="file" accept="image/*" hidden disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void uploadPhoto(f) }} />
              </label>
            </>
          )}
          <button type="button" className="adm-pill adm-primary" style={{ width: '100%' }} disabled={busy} onClick={() => void saveHall()}>
            {busy ? 'Сохраняю…' : 'Сохранить'}
          </button>
        </div>
      </Sheet>
    )
  }

  // ---------- редактор допуслуги ----------
  if (extra) {
    const set = (p: Partial<ExtraDraft>) => setExtra((d) => (d ? { ...d, ...p } : d))
    return (
      <Sheet title={extra.id ? 'Допуслуга' : 'Новая допуслуга'} onClose={() => setExtra(null)}>
        <div className="adm-glass adm-card">
          <Field label="Название"><input className="adm-input" value={extra.name} onChange={(e) => set({ name: e.target.value })} placeholder="Веник дубовый" /></Field>
          <div className="adm-row">
            <Field label="Цена, ₽ (0 — по запросу)"><input className="adm-input" type="number" min={0} inputMode="numeric" value={extra.price} onChange={(e) => set({ price: Number(e.target.value) || 0 })} /></Field>
            <Field label="Считать">
              <select className="adm-input" value={extra.unit} onChange={(e) => set({ unit: e.target.value as ExtraUnit })}>
                {(Object.keys(UNIT_RU) as ExtraUnit[]).map((u) => <option key={u} value={u}>{UNIT_RU[u]}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Порядок"><input className="adm-input" type="number" value={extra.sort_order} onChange={(e) => set({ sort_order: Number(e.target.value) || 0 })} /></Field>
          <label className="adm-switch" style={{ marginBottom: 14 }}>
            Показывать на сайте
            <input type="checkbox" checked={extra.is_active} onChange={(e) => set({ is_active: e.target.checked })} />
          </label>
          <button type="button" className="adm-pill adm-primary" style={{ width: '100%' }} disabled={busy} onClick={() => void saveExtra()}>
            {busy ? 'Сохраняю…' : 'Сохранить'}
          </button>
        </div>
      </Sheet>
    )
  }

  // ---------- список ----------
  return (
    <Sheet title="Услуги" onClose={onClose}>
      <div className="adm-seg" style={{ marginTop: 0 }}>
        <button type="button" className={`adm-pill${tab === 'halls' ? ' on' : ''}`} onClick={() => setTab('halls')}>Залы</button>
        <button type="button" className={`adm-pill${tab === 'extras' ? ' on' : ''}`} onClick={() => setTab('extras')}>Допуслуги</button>
      </div>
      <button type="button" className="adm-pill adm-primary" style={{ width: '100%', marginBottom: 14 }} onClick={() => (tab === 'halls' ? setHall({ ...HALL0 }) : setExtra({ ...EXTRA0 }))}>
        <Plus size={18} /> {tab === 'halls' ? 'Добавить зал' : 'Добавить допуслугу'}
      </button>
      {loading && <div className="spinner" style={{ margin: '24px auto' }} />}

      {tab === 'halls' && !loading && halls.length === 0 && <div className="adm-glass adm-card adm-sub" style={{ textAlign: 'center' }}>Залов пока нет — добавьте первый.</div>}
      {tab === 'halls' && halls.map((h) => (
        <div key={h.id} className="adm-glass adm-card" style={{ opacity: h.is_active ? 1 : 0.55 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{h.name}</div>
              <div className="adm-sub">
                {rub(h.price_per_hour)}/ч{h.price_happy ? ` · счастливые ${rub(h.price_happy)}` : ''} · до {h.capacity} гостей · от {h.min_hours} ч
              </div>
            </div>
            <button type="button" className="adm-icon-btn" style={{ flexShrink: 0 }} onClick={() => del('halls', h.id, h.name)} aria-label="Удалить"><Trash2 size={17} color="#ff6b6b" /></button>
          </div>
          <div className="adm-row" style={{ marginTop: 12 }}>
            <button type="button" className="adm-pill" style={{ padding: 11, fontSize: 13 }} onClick={() => setHall({ ...HALL0, ...h, description: h.description || '', features: h.features || '', price_happy: h.price_happy || 0 })}>Изменить</button>
            <button type="button" className="adm-pill" style={{ padding: 11, fontSize: 13 }} onClick={() => toggle('halls', h.id, h.is_active)}>{h.is_active ? 'Скрыть' : 'Показать'}</button>
          </div>
        </div>
      ))}

      {tab === 'extras' && !loading && extras.length === 0 && <div className="adm-glass adm-card adm-sub" style={{ textAlign: 'center' }}>Допуслуг пока нет.</div>}
      {tab === 'extras' && extras.map((x) => (
        <div key={x.id} className="adm-glass adm-card" style={{ opacity: x.is_active ? 1 : 0.55 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700 }}>{x.name}</div>
              <div className="adm-sub">{x.price > 0 ? `${rub(x.price)} ${UNIT_RU[x.unit]}` : 'по запросу'}</div>
            </div>
            <button type="button" className="adm-icon-btn" style={{ flexShrink: 0 }} onClick={() => del('extras', x.id, x.name)} aria-label="Удалить"><Trash2 size={17} color="#ff6b6b" /></button>
          </div>
          <div className="adm-row" style={{ marginTop: 12 }}>
            <button type="button" className="adm-pill" style={{ padding: 11, fontSize: 13 }} onClick={() => setExtra({ ...EXTRA0, ...x })}>Изменить</button>
            <button type="button" className="adm-pill" style={{ padding: 11, fontSize: 13 }} onClick={() => toggle('extras', x.id, x.is_active)}>{x.is_active ? 'Скрыть' : 'Показать'}</button>
          </div>
        </div>
      ))}
    </Sheet>
  )
}
