// Row shapes returned by the database (supabase/migrations). Hand-written to stay small.
import type { AgeBracket } from '../core/consent'

export interface AvatarColors {
  body: string
  skin: string
  hair: string
  top: string
  /** Accessories (hats, scarf, headphone cups, bow, stripes). Optional: older avatars lack it. */
  accent?: string
}

export type HairStyle = 'short' | 'long' | 'curly' | 'bun'
export type TopStyle = 'tee' | 'hoodie' | 'stripes' | 'collar'
export type BottomStyle = 'trousers' | 'shorts' | 'skirt'
export type Accessory =
  | 'glasses'
  | 'headphones'
  | 'beanie'
  | 'cap'
  | 'bow'
  | 'scarf'
  // shop accessories (M5): owned through inventory
  | 'beret'
  | 'cat_ears'
  | 'flower'
  | 'shades'

export interface Avatar {
  colors: AvatarColors
  /** Missing on avatars made before hairstyles existed: treat as 'short'. */
  hair?: HairStyle
  outfit?: { top?: TopStyle; bottom?: BottomStyle }
  /** At most one per slot (see ACCESSORIES). */
  accessories?: Accessory[]
  /** The face your bean makes; missing = 'happy'. */
  expression?: Expression
}

export type Expression = 'happy' | 'joyful' | 'calm' | 'focused' | 'sleepy' | 'surprised' | 'cheeky' | 'cat'

export interface Profile {
  id: string
  handle: string
  display_name: string
  avatar: Avatar
  tz: string
  country: string
  age_bracket: Exclude<AgeBracket, 'under_13'>
  consent_status: 'not_required' | 'pending' | 'granted'
  settings: {
    focusMinutes?: number
    theme?: string
    mode?: string
    /** Push types switched off (default on), read by the server when queueing (SPEC §5.5). */
    notify?: { phase_end?: boolean; checkin?: boolean }
  }
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

export interface MyRoom {
  id: string
  name: string
  role: 'owner' | 'mod' | 'member'
  invite_code: string
  member_count: number
  studying_count: number
  sync_pomodoro: boolean
  studying: { display_name: string; avatar: Avatar }[]
  /** Your place on the room's week board, or null before you have minutes there. */
  week_rank?: number | null
}

export interface LiveMember {
  user_id: string
  display_name: string
  avatar: Avatar
  state: 'focus' | 'break'
  kind: 'pomodoro' | 'stopwatch'
  started_at: string
  planned_seconds: number | null
  status_line: string | null
  sitting_seconds: number
  break_until: string | null
}

export interface RoomMember {
  user_id: string
  handle: string
  display_name: string
  avatar: Avatar
  role: 'owner' | 'mod' | 'member'
  joined_at: string
}

export type LeaderboardTab = 'live' | 'week' | 'alltime' | 'lifetime'

export interface LeaderRow {
  user_id: string
  display_name: string
  avatar: Avatar
  seconds: number
  rank: number
  is_present: boolean
}

export interface RoomPreview {
  id: string
  name: string
  member_count: number
  studying: { display_name: string; avatar: Avatar }[]
}

export interface ReportRow {
  id: number
  target_type: 'user' | 'room' | 'status_line' | 'note' | 'void'
  target_id: string
  target_user_id: string | null
  target_display_name: string | null
  target_handle: string | null
  room_id: string | null
  room_name: string | null
  reason: string
  note: string | null
  created_at: string
  context: string | null
}
