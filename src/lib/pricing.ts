/** Расчёт стоимости брони. Логика должна совпадать с pb_hooks/pricing.js (там же считает сервер). */
import { HOUR, studioParts } from './tz'
import type { Hall, ExtraUnit } from '../types'
import type { StudioSettings } from './studioSettings'

export type PricedExtra = { id: string; name: string; price: number; unit: ExtraUnit; qty: number }

export type PriceResult = {
  base: number
  baseHours: number
  happy: number
  happyHours: number
  guestsFee: number
  extraGuests: number
  extrasTotal: number
  total: number
}

export function isHappyHour(
  hall: Pick<Hall, 'price_happy'>,
  s: Pick<StudioSettings, 'happy' | 'tzOffsetMin'>,
  ms: number,
): boolean {
  if (!s.happy.enabled || !((hall.price_happy || 0) > 0)) return false
  const p = studioParts(ms, s.tzOffsetMin)
  return s.happy.days.includes(p.dow) && p.h >= s.happy.from && p.h < s.happy.to
}

export function computePrice(
  hall: Hall,
  s: StudioSettings,
  startMs: number,
  hours: number,
  guests: number,
  extras: PricedExtra[],
): PriceResult {
  let base = 0
  let happy = 0
  let baseHours = 0
  let happyHours = 0
  for (let i = 0; i < hours; i++) {
    if (isHappyHour(hall, s, startMs + i * HOUR)) {
      happy += hall.price_happy || 0
      happyHours++
    } else {
      base += hall.price_per_hour
      baseHours++
    }
  }
  const included = hall.included_guests > 0 ? hall.included_guests : guests
  const extraGuests = Math.max(0, guests - included)
  const guestsFee = extraGuests * (hall.extra_guest_price || 0) * hours
  let extrasTotal = 0
  for (const x of extras) {
    const qty = x.qty > 0 ? x.qty : 0
    if (x.unit === 'hour') extrasTotal += x.price * hours * Math.min(qty, 1)
    else if (x.unit === 'booking') extrasTotal += x.price * Math.min(qty, 1)
    else extrasTotal += x.price * qty
  }
  return { base, baseHours, happy, happyHours, guestsFee, extraGuests, extrasTotal, total: base + happy + guestsFee + extrasTotal }
}

export const rub = (n: number) => `${Math.round(n).toLocaleString('ru-RU')} ₽`
