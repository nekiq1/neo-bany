/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PB_URL?: string
  /** @deprecated use PocketBase auth */
  readonly VITE_ADMIN_LOGIN?: string
  /** @deprecated use PocketBase auth */
  readonly VITE_ADMIN_PASSWORD?: string
  /** @deprecated AI key only on server */
  readonly VITE_AI_API_KEY?: string
  readonly VITE_AI_API_BASE?: string
  readonly VITE_AI_MODEL?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
