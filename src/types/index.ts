export type ExtraUnit = 'item' | 'booking' | 'hour'

type FileRec = { id: string; collectionId?: string; collectionName?: string }

/** Зал / парная, которую арендуют по часам */
export interface Hall extends FileRec {
  studio_id: string
  name: string
  description: string | null
  /** через запятую: «Бассейн, Караоке» */
  features: string | null
  capacity: number
  included_guests: number
  extra_guest_price: number
  price_per_hour: number
  /** цена часа в «счастливые часы» (необязательно) */
  price_happy: number | null
  min_hours: number
  sort_order: number
  is_active: boolean
  photo?: string
}

/** Допуслуга: веник, полотенце, чай… */
export interface Extra {
  id: string
  studio_id: string
  name: string
  price: number
  unit: ExtraUnit
  sort_order: number
  is_active: boolean
}

export interface ExtraLine {
  id: string
  name: string
  price: number
  unit: ExtraUnit
  qty: number
}

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled'

export const UNIT_RU: Record<ExtraUnit, string> = {
  item: 'за шт.',
  booking: 'за визит',
  hour: 'за час',
}

/** Демо на случай, если PocketBase недоступен (бронь при этом отправить нельзя) */
export const DEMO_HALLS: Hall[] = [
  {
    id: 'demo-1', studio_id: 'demo', name: 'Русская баня', description: 'Классическая парная, купель и комната отдыха.',
    features: 'Русская парная, Купель, Комната отдыха', capacity: 6, included_guests: 4, extra_guest_price: 300,
    price_per_hour: 1500, price_happy: 950, min_hours: 2, sort_order: 1, is_active: true,
  },
  {
    id: 'demo-2', studio_id: 'demo', name: 'Сауна с бассейном', description: 'Бассейн с гидромассажем, подсветка, парная.',
    features: 'Бассейн, Гидромассаж, Караоке, Бильярд', capacity: 8, included_guests: 6, extra_guest_price: 300,
    price_per_hour: 1900, price_happy: 1200, min_hours: 2, sort_order: 2, is_active: true,
  },
]
