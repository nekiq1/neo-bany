import { useEffect, useState } from 'react'
import { pb, hasPocketBase } from './pb'
import { DEMO_HALLS, type Extra, type Hall } from '../types'
import { type StudioSettings } from './studioSettings'

/** Залы и допуслуги студии (публичные страницы). Без PocketBase — демо-залы, бронь недоступна. */
export function useCatalog(studioId: string | undefined) {
  const [halls, setHalls] = useState<Hall[]>([])
  const [extras, setExtras] = useState<Extra[]>([])
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(!hasPocketBase)

  useEffect(() => {
    if (!hasPocketBase) {
      setHalls(DEMO_HALLS)
      setLoading(false)
      return
    }
    if (!studioId) return
    let off = false
    void (async () => {
      try {
        const filter = `studio_id="${studioId}" && is_active=true`
        const [h, x] = await Promise.all([
          pb.collection('halls').getFullList<Hall>({ filter, sort: 'sort_order,created' }),
          pb.collection('extras').getFullList<Extra>({ filter, sort: 'sort_order,created' }),
        ])
        if (off) return
        setHalls(h)
        setExtras(x)
        setOffline(false)
      } catch {
        if (off) return
        setHalls(DEMO_HALLS)
        setOffline(true)
      } finally {
        if (!off) setLoading(false)
      }
    })()
    return () => {
      off = true
    }
  }, [studioId])

  return { halls, extras, loading, offline }
}

/** Минимальная цена часа для витрины («от …») */
export function minHourPrice(halls: Hall[], s: Pick<StudioSettings, 'happy'>): number {
  if (!halls.length) return 0
  return Math.min(
    ...halls.map((h) => (s.happy.enabled && (h.price_happy || 0) > 0 ? (h.price_happy as number) : h.price_per_hour)),
  )
}
