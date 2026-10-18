/**
 * PocketBase client + тонкая совместимость с прежним supabase-js API.
 * Страницы используют те же цепочки: .from().select().eq()...insert/update/delete
 */
import PocketBase from 'pocketbase'

const rawUrl = (import.meta.env.VITE_PB_URL as string | undefined)?.trim() || ''

/** true, если в сборку попал валидный URL PocketBase */
export const hasPocketBase = Boolean(
  rawUrl.startsWith('http') &&
    !rawUrl.includes('placeholder') &&
    !rawUrl.includes('xxxx')
)

/** Алиас для минимальных правок в страницах (было hasSupabase) */
export const hasSupabase = hasPocketBase

export const pbConfigHint = !hasPocketBase
  ? 'В сборке нет VITE_PB_URL (например http://127.0.0.1:8090)'
  : ''

/** Алиас старого имени */
export const supabaseConfigHint = pbConfigHint

if (!hasPocketBase) {
  console.warn('[PSPBRF] PocketBase offline:', pbConfigHint || 'missing env')
} else {
  console.info('[PSPBRF] PocketBase OK →', rawUrl)
}

export const pb = new PocketBase(rawUrl || 'http://127.0.0.1:8090')
// SPA: не авто-отменять запросы при навигации
pb.autoCancellation(false)

export async function withTimeout<T>(promise: PromiseLike<T>, ms = 10000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await new Promise<T>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`timeout ${ms}ms`)), ms)
      Promise.resolve(promise).then(resolve, reject)
    })
  } finally {
    if (timer) clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// Совместимый «supabase-like» фасад: supabase.from('x').select()...
// ---------------------------------------------------------------------------

type FilterOp = { field: string; op: string; value: unknown }

class QueryBuilder {
  private collection: string
  private filters: FilterOp[] = []
  private selectFields = '*'
  private sort = ''
  private limitN: number | null = null
  private singleMode = false
  private action: 'select' | 'insert' | 'update' | 'delete' = 'select'
  private payload: Record<string, unknown> | null = null

  constructor(collection: string) {
    this.collection = collection
  }

  select(fields = '*') {
    // Не перезаписываем action после insert/update/delete
    this.selectFields = fields
    return this
  }

  insert(row: Record<string, unknown> | Record<string, unknown>[]) {
    this.action = 'insert'
    this.payload = Array.isArray(row) ? row[0] : row
    return this
  }

  update(row: Record<string, unknown>) {
    this.action = 'update'
    this.payload = row
    return this
  }

  delete() {
    this.action = 'delete'
    return this
  }

  eq(field: string, value: unknown) {
    this.filters.push({ field, op: '=', value })
    return this
  }

  neq(field: string, value: unknown) {
    this.filters.push({ field, op: '!=', value })
    return this
  }

  gte(field: string, value: unknown) {
    this.filters.push({ field, op: '>=', value })
    return this
  }

  gt(field: string, value: unknown) {
    this.filters.push({ field, op: '>', value })
    return this
  }

  lte(field: string, value: unknown) {
    this.filters.push({ field, op: '<=', value })
    return this
  }

  lt(field: string, value: unknown) {
    this.filters.push({ field, op: '<', value })
    return this
  }

  order(field: string, opts?: { ascending?: boolean }) {
    const asc = opts?.ascending !== false
    const part = (asc ? '' : '-') + field
    this.sort = this.sort ? `${this.sort},${part}` : part
    return this
  }

  limit(n: number) {
    this.limitN = n
    return this
  }

  single() {
    this.singleMode = true
    return this
  }

  private buildFilter(): string {
    return this.filters
      .map(({ field, op, value }) => {
        if (value === null || value === undefined) {
          return op === '=' ? `${field}=null` : `${field}!=null`
        }
        if (typeof value === 'boolean' || typeof value === 'number') {
          return `${field}${op}${value}`
        }
        // строки / даты — в кавычках
        const s = String(value).replace(/"/g, '\\"')
        return `${field}${op}"${s}"`
      })
      .join(' && ')
  }

  private pickFields(record: Record<string, unknown>): Record<string, unknown> {
    if (!this.selectFields || this.selectFields === '*') return record
    const keys = this.selectFields.split(',').map((k) => k.trim())
    const out: Record<string, unknown> = { id: record.id }
    for (const k of keys) {
      if (k in record) out[k] = record[k]
    }
    return out
  }

  /** Thenable: можно await напрямую или через withTimeout */
  then<TResult1 = { data: any; error: Error | null }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: Error | null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected)
  }

  private async execute(): Promise<{ data: any; error: Error | null }> {
    try {
      if (!this.collection) {
        throw new Error('Missing collection name')
      }
      const col = pb.collection(this.collection)
      const filter = this.buildFilter()

      if (this.action === 'insert') {
        if (!this.payload) throw new Error('insert without payload')
        // PocketBase relation: null/"" → "Missing collection context" — убираем пустые
        const clean: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(this.payload)) {
          if (v === null || v === undefined || v === '') continue
          if (typeof v === 'string' && (v.startsWith('demo-') || v.startsWith('svc-'))) continue
          clean[k] = v
        }
        const rec = await col.create(clean)
        const data = this.singleMode
          ? this.pickFields(rec as Record<string, unknown>)
          : [this.pickFields(rec as Record<string, unknown>)]
        return { data, error: null }
      }

      if (this.action === 'update') {
        const idFilter = this.filters.find((f) => f.field === 'id' && f.op === '=')
        if (!idFilter) throw new Error('update requires .eq("id", ...)')
        const id = String(idFilter.value)
        const rec = await col.update(id, this.payload || {})
        return { data: this.pickFields(rec as Record<string, unknown>), error: null }
      }

      if (this.action === 'delete') {
        const idFilter = this.filters.find((f) => f.field === 'id' && f.op === '=')
        if (!idFilter) throw new Error('delete requires .eq("id", ...)')
        await col.delete(String(idFilter.value))
        return { data: null, error: null }
      }

      // select
      if (this.singleMode) {
        const rec = await col.getFirstListItem(filter || 'id != ""')
        return { data: this.pickFields(rec as Record<string, unknown>), error: null }
      }

      const perPage = this.limitN ?? 200
      const list = await col.getList(1, perPage, {
        filter: filter || undefined,
        sort: this.sort || undefined,
      })
      const data = list.items.map((r) => this.pickFields(r as Record<string, unknown>))
      return { data, error: null }
    } catch (e: unknown) {
      const anyErr = e as { message?: string; data?: unknown; status?: number }
      let msg = anyErr?.message || String(e)
      if (msg.includes('Missing collection context') || msg.includes('Missing or invalid collection')) {
        msg =
          'PocketBase: коллекция не найдена или битое поле relation. Перезапустите PB с --migrationsDir и проверьте /_/collections'
      }
      const err = new Error(msg)
      if (this.singleMode && /404|not found|didn't match/i.test(msg)) {
        return { data: null, error: err }
      }
      return { data: null, error: err }
    }
  }
}

/** Совместимый клиент: supabase.from('bookings')... */
export const supabase = {
  from(collection: string) {
    return new QueryBuilder(collection)
  },
}

/** Auth helpers для Admin */
export async function adminLogin(email: string, password: string) {
  try {
    return await pb.collection('users').authWithPassword(email, password)
  } catch (err) {
    // суперпользователь PocketBase (/_/) тоже может войти в админку
    try {
      return await pb.collection('_superusers').authWithPassword(email, password)
    } catch {
      throw err
    }
  }
}

export function adminLogout() {
  pb.authStore.clear()
}

export function isAdminAuthed(): boolean {
  return pb.authStore.isValid
}

export function getAdminEmail(): string | null {
  return (pb.authStore.model as { email?: string } | null)?.email ?? null
}
