import type { Session } from '@supabase/supabase-js'
import { create } from 'zustand'
import type { Profile } from '../lib/db'
import { isConfigured, supabase } from '../lib/supabase'
import { useTheme } from './theme'

export type AuthStatus =
  'loading' | 'unconfigured' | 'signed_out' | 'needs_profile' | 'pending' | 'ready' | 'error'

interface AuthState {
  status: AuthStatus
  session: Session | null
  profile: Profile | null
  personalRoomId: string | null
  init: () => void
  reload: () => Promise<void>
  signOut: () => Promise<void>
}

let initialized = false

export const useAuth = create<AuthState>((set, get) => ({
  status: isConfigured ? 'loading' : 'unconfigured',
  session: null,
  profile: null,
  personalRoomId: null,

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
    if (profileRes.error) {
      set({ status: 'error' })
      return
    }
    const profile = (profileRes.data as Profile | null) ?? null
    useTheme.getState().adoptFromProfile(profile?.settings as Record<string, unknown> | undefined)
    set({
      profile,
      personalRoomId: (roomRes.data as { id: string } | null)?.id ?? null,
      status: !profile ? 'needs_profile' : profile.consent_status === 'pending' ? 'pending' : 'ready',
    })
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ session: null, profile: null, personalRoomId: null, status: 'signed_out' })
  },
}))
