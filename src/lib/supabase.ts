import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseConfig } from '../config'

export const isConfigured = Boolean(supabaseConfig.url && supabaseConfig.anonKey)

// Only the public URL and anon key ever reach the browser (SPEC §18).
export const supabase: SupabaseClient = createClient(
  supabaseConfig.url || 'http://localhost.invalid',
  supabaseConfig.anonKey || 'missing',
  { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
)

// fetch() failures as Chrome, Firefox and Safari word them.
const NETWORK = /Failed to fetch|NetworkError|Load failed|network|fetch failed/i

/**
 * Error codes raised by our RPCs (`raise exception '<code>'`), surfaced as the PostgREST message.
 * No connection → 'offline'; any other error always yields a code, so `if (error)` paths never pass.
 */
export function rpcErrorCode(error: { message?: string; code?: string } | null): string | null {
  if (!error) return null
  const message = error.message ?? ''
  if (/^[a-z_]+$/.test(message)) return message
  // The app is newer than the database (migrations not pushed yet): say so instead of "try again".
  if (
    /^(PGRST202|PGRST205|42883|42P01|42703)$/.test(error.code ?? '') ||
    /Could not find the (function|table)/.test(message)
  )
    return 'schema_outdated'
  if (NETWORK.test(message) || (typeof navigator !== 'undefined' && !navigator.onLine)) return 'offline'
  return 'unknown'
}
