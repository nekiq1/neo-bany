import type { StudioRecord } from '../../lib/studioSettings'
import type { BookingStatus, ExtraLine } from '../../types'

export type SectionProps = {
  studio: StudioRecord
  onClose: () => void
  /** перечитать студию/настройки после сохранения */
  onChanged: () => Promise<void> | void
  notify: (msg: string, error?: boolean) => void
}

export type BookingRow = {
  id: string
  hall_id?: string | null
  hall_name?: string | null
  customer_name: string
  customer_phone: string
  guests?: number | null
  hours?: number | null
  start_at: string
  end_at: string
  extras?: ExtraLine[] | null
  total?: number | null
  paid?: boolean
  notes?: string | null
  status: BookingStatus
}

export const BLOCK_PHONE = 'block'

export function isBlock(b: Pick<BookingRow, 'customer_phone' | 'customer_name'>): boolean {
  return b.customer_phone === BLOCK_PHONE || (b.customer_name || '').includes('Блокировка')
}

/** Сохранить часть настроек студии в studios.settings (остальные ключи не трогаем) */
export async function patchSettings(
  pbCollection: { update: (id: string, data: Record<string, unknown>) => Promise<unknown> },
  studio: StudioRecord,
  patch: Record<string, unknown>,
) {
  const current = (studio.settings || {}) as Record<string, unknown>
  await pbCollection.update(studio.id, { settings: { ...current, ...patch } })
}
