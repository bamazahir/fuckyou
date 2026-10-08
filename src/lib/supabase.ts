import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { supabaseConfig } from '../config'

export const isConfigured = Boolean(supabaseConfig.url && supabaseConfig.anonKey)

// Only the public URL and anon key ever reach the browser (SPEC §18).
export const supabase: SupabaseClient = createClient(
  supabaseConfig.url || 'http://localhost.invalid',
  supabaseConfig.anonKey || 'missing',
  { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
)

/** Error codes raised by our RPCs (`raise exception '<code>'`), surfaced as the PostgREST message. */
export function rpcErrorCode(error: { message?: string } | null): string | null {
  if (!error?.message) return null
  return /^[a-z_]+$/.test(error.message) ? error.message : 'unknown'
}
