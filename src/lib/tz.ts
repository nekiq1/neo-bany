/**
 * Время бани всегда считается в часовом поясе студии (settings.tzOffsetMin, по умолчанию МСК = +180),
 * а не в поясе устройства посетителя — иначе «счастливые часы» и слоты поедут.
 */
export const HOUR = 3600000
export const DEFAULT_TZ = 180

export function studioParts(ms: number, tz: number) {
  const d = new Date(ms + tz * 60000)
  return {
    y: d.getUTCFullYear(),
    mo: d.getUTCMonth(),
    d: d.getUTCDate(),
    h: d.getUTCHours(),
    mi: d.getUTCMinutes(),
    dow: d.getUTCDay() || 7, // 1 = пн … 7 = вс
  }
}

export function studioMs(y: number, mo: number, d: number, h: number, mi: number, tz: number) {
  return Date.UTC(y, mo, d, h, mi) - tz * 60000
}

/** PocketBase: "2026-10-18 10:00:00.000Z" или ISO → миллисекунды */
export function parsePb(s: string): number {
  return new Date(String(s).replace(' ', 'T')).getTime()
}

/** Date, «локальные» поля которого равны времени студии — для форматирования через date-fns */
export function toView(ms: number, tz: number): Date {
  const p = studioParts(ms, tz)
  return new Date(p.y, p.mo, p.d, p.h, p.mi)
}

/** Обратное преобразование: Date с полями «времени студии» → реальные миллисекунды */
export function fromView(d: Date, tz: number): number {
  return studioMs(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), tz)
}

/** 'yyyy-MM-dd' в поясе студии */
export function dayKey(ms: number, tz: number): string {
  const p = studioParts(ms, tz)
  return `${p.y}-${String(p.mo + 1).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`
}

/** Начало суток (UTC-мс) для 'yyyy-MM-dd' в поясе студии */
export function dayStartMs(key: string, tz: number): number {
  const [y, m, d] = key.split('-').map(Number)
  return studioMs(y, m - 1, d, 0, 0, tz)
}
