import { describe, expect, it } from 'vitest'
import { joinAction, syncPhase } from './sync'

// The same vectors as supabase/tests/database/05_m3_push_sync.test.sql (private.sync_phase).
const s = { epochMs: Date.parse('2026-10-10T10:00:00Z'), focusS: 1500, breakS: 300 }
const at = (iso: string) => Date.parse(iso)

describe('syncPhase', () => {
  it('is in focus for the first focusS seconds of each cycle', () => {
    expect(syncPhase(s, at('2026-10-10T10:10:00Z'))).toMatchObject({ phase: 'focus', left: 900 })
  })

  it('then on a shared break until the next cycle', () => {
    const p = syncPhase(s, at('2026-10-10T10:27:00Z'))
    expect(p).toMatchObject({ phase: 'break', left: 180 })
    expect(p.nextFocusAtMs).toBe(at('2026-10-10T10:30:00Z'))
  })

  it('repeats every cycle and works before the epoch', () => {
    expect(syncPhase(s, at('2026-10-10T11:00:00Z'))).toMatchObject({ phase: 'focus', left: 1500 })
    expect(syncPhase(s, at('2026-10-10T09:59:50Z'))).toMatchObject({ phase: 'break', left: 10 })
  })
})

describe('joinAction', () => {
  it('joins a focus with at least 5 minutes left, otherwise waits', () => {
    expect(joinAction(syncPhase(s, at('2026-10-10T10:10:00Z')))).toBe('join_now')
    expect(joinAction(syncPhase(s, at('2026-10-10T10:21:00Z')))).toBe('join_next')
    expect(joinAction(syncPhase(s, at('2026-10-10T10:27:00Z')))).toBe('join_next')
  })
})
