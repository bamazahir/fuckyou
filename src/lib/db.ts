// Row shapes returned by the database (supabase/migrations). Hand-written to stay small.
import type { AgeBracket } from '../core/consent'

export interface AvatarColors {
  body: string
  skin: string
  hair: string
  top: string
}

export interface Avatar {
  colors: AvatarColors
  accessories?: string[]
}

export interface Profile {
  id: string
  handle: string
  display_name: string
  avatar: Avatar
  tz: string
  country: string
  age_bracket: Exclude<AgeBracket, 'under_13'>
  consent_status: 'not_required' | 'pending' | 'granted'
  settings: { focusMinutes?: number }
  is_admin: boolean
  created_at: string
}

export interface Room {
  id: string
  name: string
  is_personal: boolean
}

export interface SessionRow {
  id: string
  user_id: string
  room_id: string
  sitting_id: string
  kind: 'pomodoro' | 'stopwatch'
  status: 'active' | 'completed' | 'voided'
  status_line: string | null
  planned_seconds: number | null
  started_at: string
  ended_at: string | null
  next_checkin_at: string | null
  focus_seconds: number | null
  note: string | null
  note_public: boolean
}
