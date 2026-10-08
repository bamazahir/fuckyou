export const APP_NAME = 'Studyroom'

/** Public Supabase settings. Only the URL and anon key may ever reach the client (SPEC §18). */
export const supabaseConfig = {
  url: import.meta.env.VITE_SUPABASE_URL ?? '',
  anonKey: import.meta.env.VITE_SUPABASE_ANON_KEY ?? '',
}
