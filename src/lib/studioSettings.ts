/**
 * Настройки студии. Источник правды — PocketBase (studios.settings, studios.logo/hero, works).
 * localStorage используется только как кэш для мгновенной первой отрисовки.
 */
import { useCallback, useEffect, useState } from 'react'
import { pb, hasPocketBase } from './pb'

export type GalleryCard = {
  id: string
  title: string
  image: string
  scale?: number
  x?: number
  y?: number
}

export type HappyHours = { enabled: boolean; from: number; to: number; days: number[] }
export type Promo = { title: string; text: string }

export type StudioSettings = {
  /** смещение часового пояса студии от UTC, мин (МСК = 180) */
  tzOffsetMin: number
  /** круглосуточно */
  open24: boolean
  workStart: number
  workEnd: number
  maxHours: number
  /** перерыв на уборку между бронями, мин */
  cleanupMinutes: number
  /** за сколько минут до начала ещё можно бронировать */
  leadMinutes: number
  happy: HappyHours
  features: string[]
  promos: Promo[]
  site: string
  lat: number
  lng: number
  heroScale: number
  heroX: number
  heroY: number
}

export type StudioRecord = {
  id: string
  slug: string
  name: string
  address: string | null
  description: string | null
  phone: string | null
  is_active: boolean
  logo?: string
  hero?: string
  settings?: Partial<StudioSettings> | null
  collectionId?: string
  collectionName?: string
}

export type StudioConfig = {
  studio: StudioRecord | null
  settings: StudioSettings
  logoUrl: string
  heroUrl: string
}

export const DEFAULT_SLUG = 'kaplya'
const KEY = 'banya-studio-config-v1'

export const DEFAULT_GALLERY: GalleryCard[] = [
  { id: 'g1', title: 'Русская парная', image: '/images/gallery-1.svg', scale: 1, x: 0, y: 0 },
  { id: 'g2', title: 'Бассейн', image: '/images/gallery-2.svg', scale: 1, x: 0, y: 0 },
  { id: 'g3', title: 'Зона отдыха', image: '/images/gallery-3.svg', scale: 1, x: 0, y: 0 },
]

export const DEFAULT_SETTINGS: StudioSettings = {
  tzOffsetMin: 180,
  open24: true,
  workStart: 10,
  workEnd: 22,
  maxHours: 12,
  cleanupMinutes: 30,
  leadMinutes: 60,
  happy: { enabled: false, from: 10, to: 17, days: [1, 2, 3, 4, 5] },
  features: [],
  promos: [],
  site: '',
  lat: 0,
  lng: 0,
  heroScale: 1,
  heroX: 0,
  heroY: 0,
}

export const DEFAULT_LOGO = '/images/logo.svg'
export const DEFAULT_HERO = '/images/hero.svg'

const num = (v: unknown, def: number) => (typeof v === 'number' && Number.isFinite(v) ? v : def)
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

export function normalizeSettings(p: Partial<StudioSettings> | null | undefined): StudioSettings {
  const s = (p || {}) as Partial<StudioSettings>
  const D = DEFAULT_SETTINGS
  const h = (s.happy || {}) as Partial<HappyHours>
  return {
    tzOffsetMin: clamp(num(s.tzOffsetMin, D.tzOffsetMin), -720, 840),
    open24: s.open24 !== false,
    workStart: clamp(Math.floor(num(s.workStart, D.workStart)), 0, 23),
    workEnd: clamp(Math.floor(num(s.workEnd, D.workEnd)), 1, 24),
    maxHours: clamp(Math.floor(num(s.maxHours, D.maxHours)), 1, 24),
    cleanupMinutes: clamp(Math.floor(num(s.cleanupMinutes, D.cleanupMinutes)), 0, 240),
    leadMinutes: clamp(Math.floor(num(s.leadMinutes, D.leadMinutes)), 0, 1440),
    happy: {
      enabled: Boolean(h.enabled),
      from: clamp(Math.floor(num(h.from, 10)), 0, 23),
      to: clamp(Math.floor(num(h.to, 17)), 1, 24),
      days: Array.isArray(h.days) ? h.days.filter((d) => d >= 1 && d <= 7) : [1, 2, 3, 4, 5],
    },
    features: Array.isArray(s.features) ? s.features.map(String).filter(Boolean) : [],
    promos: Array.isArray(s.promos)
      ? s.promos.filter((x) => x && x.title).map((x) => ({ title: String(x.title), text: String(x.text || '') }))
      : [],
    site: typeof s.site === 'string' ? s.site : '',
    lat: num(s.lat, 0),
    lng: num(s.lng, 0),
    heroScale: clamp(num(s.heroScale, 1), 1, 3),
    heroX: num(s.heroX, 0),
    heroY: num(s.heroY, 0),
  }
}

function emptyConfig(): StudioConfig {
  return { studio: null, settings: { ...DEFAULT_SETTINGS }, logoUrl: DEFAULT_LOGO, heroUrl: DEFAULT_HERO }
}

/** Синхронное чтение кэша (для первой отрисовки) */
export function loadSettings(): StudioSettings {
  return loadCachedConfig().settings
}

export function loadCachedConfig(): StudioConfig {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyConfig()
    const c = JSON.parse(raw) as StudioConfig
    return { ...emptyConfig(), ...c, settings: normalizeSettings(c.settings) }
  } catch {
    return emptyConfig()
  }
}

function cacheConfig(c: StudioConfig) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c))
  } catch {
    /* ignore */
  }
}

export function fileUrl(record: { id: string; collectionId?: string; collectionName?: string }, name?: string) {
  if (!name) return ''
  return pb.files.getURL(record as never, name)
}

export function formatHourRange(start: number, end: number) {
  const f = (h: number) => `${String(h % 24).padStart(2, '0')}:00`
  return `${f(start)}–${f(end)}`
}

export function workLabel(s: StudioSettings) {
  return s.open24 ? 'Круглосуточно' : formatHourRange(s.workStart, s.workEnd)
}

/** Загрузить студию + настройки с сервера */
export async function fetchStudioConfig(slug = DEFAULT_SLUG): Promise<StudioConfig> {
  if (!hasPocketBase) return loadCachedConfig()
  try {
    const studio = await pb.collection('studios').getFirstListItem<StudioRecord>(`slug="${slug}"`)
    const cfg: StudioConfig = {
      studio,
      settings: normalizeSettings(studio.settings),
      logoUrl: studio.logo ? fileUrl(studio, studio.logo) : DEFAULT_LOGO,
      heroUrl: studio.hero ? fileUrl(studio, studio.hero) : DEFAULT_HERO,
    }
    cacheConfig(cfg)
    return cfg
  } catch {
    return loadCachedConfig()
  }
}

/** Хук для публичных страниц: сразу отдаёт кэш, затем обновляет с сервера */
export function useStudioConfig(slug = DEFAULT_SLUG) {
  const [config, setConfig] = useState<StudioConfig>(() => loadCachedConfig())
  const reload = useCallback(async () => {
    setConfig(await fetchStudioConfig(slug))
  }, [slug])
  useEffect(() => {
    void reload()
  }, [reload])
  return { config, reload }
}

// ---------------------------------------------------------------------------
// Работы / карточки витрины (коллекция works)
// ---------------------------------------------------------------------------

export type WorkRecord = {
  id: string
  collectionId: string
  collectionName: string
  studio_id?: string
  title: string
  image: string
  sort_order?: number
  scale?: number
  x?: number
  y?: number
}

export function workToCard(w: WorkRecord): GalleryCard {
  return {
    id: w.id,
    title: w.title || '',
    image: fileUrl(w, w.image),
    scale: w.scale || 1,
    x: w.x || 0,
    y: w.y || 0,
  }
}

export async function fetchWorks(): Promise<WorkRecord[]> {
  if (!hasPocketBase) return []
  try {
    return await pb.collection('works').getFullList<WorkRecord>({ sort: 'sort_order,created' })
  } catch {
    return []
  }
}

/** Хук для витрины: если в БД работ нет — показываем стандартные */
export function useWorks() {
  const [cards, setCards] = useState<GalleryCard[]>(DEFAULT_GALLERY)
  useEffect(() => {
    let off = false
    void fetchWorks().then((list) => {
      if (!off && list.length) setCards(list.map(workToCard))
    })
    return () => {
      off = true
    }
  }, [])
  return cards
}
