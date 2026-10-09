import type { Session } from '@supabase/supabase-js'
import { create } from 'zustand'
import type { Avatar, Profile } from '../lib/db'
import { isConfigured, rpcErrorCode, supabase } from '../lib/supabase'
import { errorMessage } from '../content/copy'
import { useUi } from './ui'
import { usePush } from './push'
import { useTheme } from './theme'
import { useWallet } from './wallet'

export type AuthStatus =
  'loading' | 'unconfigured' | 'signed_out' | 'needs_profile' | 'pending' | 'ready' | 'error'

interface AuthState {
  status: AuthStatus
  session: Session | null
  profile: Profile | null
  personalRoomId: string | null
  /** Last load failure, shown on the error screen so problems are diagnosable (e.g. missing migrations). */
  loadError: string | null
  init: () => void
  reload: () => Promise<void>
  signOut: () => Promise<void>
  /** Saves the bean colors (profiles.avatar is user-editable, SPEC §8.2). Returns an error code or null. */
  updateAvatar: (avatar: Avatar) => Promise<string | null>
  /** Merges into profiles.settings (user-editable). Returns an error code or null. */
  updateSettings: (patch: Partial<Profile['settings']>) => Promise<string | null>
}

let initialized = false

export const useAuth = create<AuthState>((set, get) => ({
  status: isConfigured ? 'loading' : 'unconfigured',
  session: null,
  profile: null,
  personalRoomId: null,
  loadError: null,

  init: () => {
    if (initialized || !isConfigured) return
    initialized = true
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session })
      // Never await Supabase calls inside this callback; defer them (supabase-js guidance).
      window.setTimeout(() => void get().reload(), 0)
    })
  },

  reload: async () => {
    const { session } = get()
    if (!session) {
      set({ status: 'signed_out', profile: null, personalRoomId: null })
      return
    }
    const [profileRes, roomRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
      supabase.from('rooms').select('id').eq('is_personal', true).maybeSingle(),
    ])
    // Once the app is open, a failed background refresh (token refresh, reconnect) keeps what we have
    // instead of swapping the whole app for the error page mid-session.
    const loaded = get().status === 'ready' && get().profile?.id === session.user.id
    if (loaded && (profileRes.error || roomRes.error)) return
    if (profileRes.error || roomRes.error) {
      const e = (profileRes.error ?? roomRes.error) as { code?: string; message?: string }
      set({ status: 'error', loadError: [e.code, e.message].filter(Boolean).join(': ') || 'unknown' })
      return
    }
    const profile = (profileRes.data as Profile | null) ?? null
    useTheme.getState().adoptFromProfile(profile?.settings as Record<string, unknown> | undefined)
    set({
      loadError: null,
      profile,
      personalRoomId: (roomRes.data as { id: string } | null)?.id ?? null,
      status: !profile ? 'needs_profile' : profile.consent_status === 'pending' ? 'pending' : 'ready',
    })
  },

  updateAvatar: async (avatar) => {
    const profile = get().profile
    if (!profile) return 'not_signed_in'
    const { error } = await supabase.from('profiles').update({ avatar }).eq('id', profile.id)
    if (error) return 'generic'
    set({ profile: { ...profile, avatar } })
    return null
  },

  updateSettings: async (patch) => {
    const profile = get().profile
    if (!profile) return 'not_signed_in'
    const settings = { ...profile.settings, ...patch }
    set({ profile: { ...profile, settings } }) // optimistic: toggles respond instantly
    const { error } = await supabase.from('profiles').update({ settings }).eq('id', profile.id)
    if (error) {
      set({ profile })
      const code = rpcErrorCode(error) === 'offline' ? 'offline' : 'generic'
      useUi.getState().toast(errorMessage(code))
      return code
    }
    return null
  },

  signOut: async () => {
    // This device shouldn't keep getting the account's notifications (ship-audit §C).
    await usePush
      .getState()
      .disable()
      .catch(() => undefined)
    await supabase.auth.signOut()
    useWallet.getState().clear()
    set({ session: null, profile: null, personalRoomId: null, status: 'signed_out' })
  },
}))
