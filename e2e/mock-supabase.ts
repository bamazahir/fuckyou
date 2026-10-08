import type { Page, Route } from '@playwright/test'

// A tiny in-memory stand-in for the Supabase REST/Auth API, so e2e runs without a backend.
// It only implements what the app calls; the real rules are tested in supabase/tests (pgTAP).

export const SUPABASE_URL = 'http://supabase.test'
const STORAGE_KEY = 'sb-supabase-auth-token'
export const USER_ID = '00000000-0000-4000-8000-000000000001'

type Row = Record<string, unknown>

export interface MockState {
  profile: Row | null
  sessions: Row[]
  calls: { name: string; body: Row }[]
}

function fakeJwt(): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const exp = Math.floor(Date.now() / 1000) + 2 * 86400
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER_ID, role: 'authenticated', aud: 'authenticated', exp })}.sig`
}

export const user = { id: USER_ID, aud: 'authenticated', role: 'authenticated', email: 'ana@example.com' }

export async function signIn(page: Page): Promise<void> {
  const session = {
    access_token: fakeJwt(),
    refresh_token: 'refresh',
    token_type: 'bearer',
    expires_in: 2 * 86400,
    expires_at: Math.floor(Date.now() / 1000) + 2 * 86400,
    user,
  }
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [
    STORAGE_KEY,
    JSON.stringify(session),
  ] as const)
}

export const readyProfile: Row = {
  id: USER_ID,
  handle: 'ana',
  display_name: 'Ana',
  avatar: { colors: { body: '#6FA06B', skin: '#E1A97F', hair: '#2B2622', top: '#7FB2D9' } },
  tz: 'UTC',
  country: 'GB',
  age_bracket: '16-17',
  consent_status: 'not_required',
  settings: {},
  is_admin: false,
  created_at: new Date().toISOString(),
}

export async function mockSupabase(page: Page, initial: Partial<MockState> = {}): Promise<MockState> {
  const state: MockState = { profile: null, sessions: [], calls: [], ...initial }
  const json = (route: Route, body: unknown, status = 200) =>
    route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

  await page.route(`${SUPABASE_URL}/**`, async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = url.pathname
    const wantsObject = (req.headers()['accept'] ?? '').includes('vnd.pgrst.object')
    const one = (rows: Row[]) =>
      wantsObject
        ? rows[0]
          ? json(route, rows[0])
          : json(route, { code: 'PGRST116' }, 406)
        : json(route, rows)

    if (path.startsWith('/auth/v1/')) {
      if (path.endsWith('/user')) return json(route, user)
      if (path.endsWith('/logout')) return route.fulfill({ status: 204 })
      return json(route, {})
    }

    if (path.startsWith('/rest/v1/rpc/')) {
      const name = path.slice('/rest/v1/rpc/'.length)
      const body = (req.postDataJSON() as Row | null) ?? {}
      state.calls.push({ name, body })
      const now = new Date()
      switch (name) {
        case 'server_time':
          return json(route, now.toISOString())
        case 'log_event':
          return route.fulfill({ status: 204 })
        case 'reject_underage':
          return route.fulfill({ status: 204 })
        case 'complete_profile':
          state.profile = {
            ...readyProfile,
            handle: body.p_handle,
            display_name: body.p_display_name,
            avatar: body.p_avatar,
            country: body.p_country,
            age_bracket: body.p_age_bracket,
          }
          return json(route, 'not_required')
        case 'start_session': {
          const s: Row = {
            id: `s${state.sessions.length + 1}`,
            user_id: USER_ID,
            room_id: body.p_room_id,
            sitting_id: 'sit-1',
            kind: body.p_kind,
            status: 'active',
            status_line: body.p_status_line,
            planned_seconds: body.p_planned_seconds,
            started_at: new Date(now.getTime() - 60_000).toISOString(),
            ended_at: null,
            next_checkin_at:
              body.p_kind === 'stopwatch' ? new Date(now.getTime() + 49 * 60_000).toISOString() : null,
            focus_seconds: null,
            note: null,
            note_public: false,
          }
          state.sessions.push(s)
          return json(route, s)
        }
        case 'end_session': {
          const s = state.sessions.find((x) => x.id === body.p_session_id)
          if (!s) return json(route, { message: 'session_not_found' }, 400)
          if (s.status === 'active') {
            s.status = 'completed'
            s.ended_at = now.toISOString()
            s.focus_seconds = Math.floor((now.getTime() - Date.parse(String(s.started_at))) / 1000)
          }
          return json(route, s)
        }
        case 'submit_note': {
          const s = state.sessions.find((x) => x.id === body.p_session_id)
          if (s) s.note = String(body.p_note).trim()
          return json(route, 0)
        }
        default:
          return json(route, { message: 'unknown' }, 400)
      }
    }

    if (path === '/rest/v1/profiles') return one(state.profile ? [state.profile] : [])
    if (path === '/rest/v1/rooms') return one(state.profile ? [{ id: 'room-personal' }] : [])
    if (path === '/rest/v1/sessions') {
      const status = url.searchParams.get('status')
      let rows = state.sessions
      if (status === 'eq.active') rows = rows.filter((s) => s.status === 'active')
      if (status === 'neq.active') rows = rows.filter((s) => s.status !== 'active')
      if (req.method() === 'HEAD')
        return route.fulfill({ status: 200, headers: { 'content-range': `0-0/${rows.length}` } })
      return one([...rows].reverse())
    }
    return json(route, { message: `unmocked ${req.method()} ${path}` }, 404)
  })
  return state
}
