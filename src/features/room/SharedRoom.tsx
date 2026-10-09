import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Dialog } from '../../components/Dialog'
import { CoinIcon } from '../../components/icons'
import { RoomScene } from '../../components/RoomScene'
import { ErrorText } from '../../components/Screen'
import { useDaypart } from '../../components/useDaypart'
import { useNow } from '../../components/useNow'
import { copy } from '../../content/copy'
import { DEFAULT_SHARED, SHARED_SIZE } from '../../content/layouts'
import { joinOrder, liveClock } from '../../core/live'
import { roomBanner, shortDuration } from '../../core/room'
import { syncPhase } from '../../core/sync'
import type { LiveMember, MyRoom, RoomMember } from '../../lib/db'
import type { SceneAvatar } from '../../scene/IsoRoom'
import { rpcErrorCode, supabase } from '../../lib/supabase'
import { useAuth } from '../../stores/auth'
import { usePush } from '../../stores/push'
import { useRooms } from '../../stores/rooms'
import { useTimer } from '../../stores/timer'
import { useUi } from '../../stores/ui'
import { Desk, EmptyDesk } from './Desk'
import { Leaderboard } from './Leaderboard'
import { MemberSheet } from './MemberSheet'
import { NoteDialog } from './NoteDialog'
import { RoomSettings } from './RoomSettings'
import { TimerDock } from './TimerDock'
import { DonateDialog } from './DonateDialog'
import { STATIONS } from '../../content/stations'
import { resolveStation } from '../../core/radio'
import { RadioPanel } from '../radio/RadioPanel'
import { useRoomRadio } from '../radio/useRoomRadio'
import { RoomView } from './RoomView'
import { useRoomInfo } from './useRoomInfo'
import { REACTIONS, useRoomChannel } from './useRoomChannel'

const t = copy.room
const SCENE_BOX = 'h-[min(52svh,480px)] min-h-72 lg:h-[560px]'

async function fetchMembers(roomId: string): Promise<RoomMember[]> {
  const { data } = await supabase.rpc('room_members_list', { p_room_id: roomId })
  return (data as RoomMember[] | null) ?? []
}

function toSceneAvatar(m: LiveMember, meId: string, nowMs: number, bubble?: string): SceneAvatar {
  const { focusing, clock } = liveClock(m, nowMs)
  return {
    id: m.user_id,
    name: m.display_name,
    avatar: m.avatar,
    state: focusing ? 'focus' : 'break',
    clock,
    bubble,
    isMe: m.user_id === meId,
    ariaLabel: [
      t.label(m.display_name, focusing ? t.focusingLabel : t.onBreak, clock),
      focusing ? m.status_line : null,
    ]
      .filter(Boolean)
      .join(', '),
  }
}

export function SharedRoom({ room }: { room: MyRoom }) {
  const navigate = useNavigate()
  const me = useAuth((s) => s.profile)
  const daypart = useDaypart()
  const { phase, afterEnded } = useTimer()
  const { leave } = useRooms()
  const toast = useUi((s) => s.toast)
  const { live, online, bubbles, removed, refresh, react, nudge, syncKey, setSync } = useRoomChannel(room.id)
  const { info, refetch: refetchInfo } = useRoomInfo(room.id, syncKey)
  const sync = info?.sync ?? null
  // Received nudges are dropped during a shared focus too, not just the button (SPEC §6.2.1).
  useEffect(() => setSync(sync), [setSync, sync])
  const [notifyOn, setNotifyOn] = useState<boolean | null>(null)
  const now = useNow(true)
  const sharedPhase = sync ? syncPhase(sync, now) : null
  const [tab, setTab] = useState<'leaderboard' | 'radio' | 'members'>('leaderboard')
  // A pick shows straight away, until room_info (refetched on the 'station' broadcast) catches up.
  const [picked, setPicked] = useState<{ id: string; over: string | null } | null>(null)
  const roomStation = info?.stationId ?? null
  const station = resolveStation(STATIONS, picked && picked.over === roomStation ? picked.id : roomStation)
  useRoomRadio(room.id, station)
  const [members, setMembers] = useState<RoomMember[] | null>(null)
  const [openMember, setOpenMember] = useState<RoomMember | null>(null)
  const [sheet, setSheet] = useState<'menu' | 'settings' | 'leave' | 'donate' | null>(null)
  const [membersKey, setMembersKey] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void fetchMembers(room.id).then((rows) => {
      if (!cancelled) setMembers(rows)
    })
    return () => {
      cancelled = true
    }
  }, [room.id, membersKey, live?.length])

  useEffect(() => {
    if (removed) {
      toast(t.removed)
      navigate('/', { replace: true })
    }
  }, [removed, navigate, toast])

  const myRole = members?.find((m) => m.user_id === me?.id)?.role ?? room.role
  const liveRows = useMemo(() => live ?? [], [live])
  const studyingIds = liveRows.filter((r) => r.state === 'focus').map((r) => r.user_id)
  const mine = liveRows.find((r) => r.user_id === me?.id)
  const banner = me ? roomBanner(studyingIds, me.id, mine?.sitting_seconds ?? 0, new Date().getHours()) : null
  const bubbleFor = (uid: string) =>
    [...bubbles].reverse().find((b) => b.userId === uid && Date.now() - b.at < 4000)?.text
  const onlineIdle = useMemo(
    () =>
      (members ?? []).filter((m) => online.has(m.user_id) && !liveRows.some((r) => r.user_id === m.user_id)),
    [members, online, liveRows],
  )
  // Free desks fill the last row (2 columns on phones, 3 from sm), with at least 4 / 3 desks in all,
  // so a quiet room still looks like a room.
  const n = liveRows.length
  const freeMobile = Math.max(4, Math.ceil(n / 2) * 2) - n
  const freeWide = Math.max(3, Math.ceil(n / 3) * 3) - n
  const deskSlots = Math.max(freeMobile, freeWide)
  const freeClass = (i: number) => (i >= freeMobile ? 'hidden sm:block' : i >= freeWide ? 'sm:hidden' : '')
  const inviteUrl = `${window.location.origin}/j/${room.invite_code}`
  const byId = new Map(liveRows.map((r) => [r.user_id, r]))
  const sceneAvatars = joinOrder(liveRows, now).flatMap((id) => {
    const row = byId.get(id)
    return row && me ? [toSceneAvatar(row, me.id, now, bubbleFor(id))] : []
  })
  const openById = (id: string) => {
    const member = members?.find((x) => x.user_id === id)
    if (member) setOpenMember(member)
  }
  const bannerText = banner
    ? banner.kind === 'empty'
      ? t.emptyRoom
      : banner.kind === 'night_owl'
        ? t.nightOwl(shortDuration(banner.seconds))
        : t.alone(shortDuration(banner.seconds))
    : null

  async function pickStation(id: string) {
    setPicked({ id, over: roomStation })
    const { error: err } = await supabase.rpc('set_room', { p_room_id: room.id, p_station_id: id })
    if (err) {
      setPicked(null)
      setError(rpcErrorCode(err))
    } else refetchInfo()
  }

  async function copyInvite() {
    try {
      if (navigator.share) await navigator.share({ title: room.name, url: inviteUrl })
      else {
        await navigator.clipboard.writeText(inviteUrl)
        toast(t.copied)
      }
    } catch {
      // share sheet dismissed
    }
    setSheet(null)
  }

  async function toggleNotify(on: boolean) {
    setNotifyOn(on)
    const { error: err } = await supabase.rpc('set_room_notify', { p_room_id: room.id, p_on: on })
    if (err) {
      setNotifyOn(null)
      return setError(rpcErrorCode(err))
    }
    refetchInfo()
    // The toggle is saved either way; pushes only reach devices that have them turned on.
    if (on) void usePush.getState().offer('room')
  }

  async function doLeave() {
    const err = await leave(room.id)
    if (err) return setError(err)
    navigate('/', { replace: true })
  }

  if (!me) return null
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1 basis-44">
          <h1 className="font-display truncate text-3xl font-bold">{room.name}</h1>
          <p className="text-on-bg-muted">
            {t.present(studyingIds.length)} · {copy.home.members(room.member_count)}
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-primary" onClick={() => void copyInvite()}>
            {t.invite}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            aria-label={t.menu}
            onClick={() => setSheet('menu')}
          >
            ⋯
          </button>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(20rem,1fr)]">
        <section aria-label={t.focusingLabel} className="min-w-0 space-y-4">
          <div className="card card-raised overflow-hidden">
            {/* Mount the scene once live state is in, so only later arrivals walk in. */}
            {live === null ? (
              <div className={`scene ${SCENE_BOX}`} />
            ) : (
              <RoomView
                className={SCENE_BOX}
                size={SHARED_SIZE}
                layout={info && info.layout.length > 0 ? info.layout : DEFAULT_SHARED}
                avatars={sceneAvatars}
                night={daypart === 'night'}
                lampOn={studyingIds.length > 0 || daypart === 'night'}
                label={t.sceneLabel(room.name)}
                onSelect={openById}
                fallback={
                  <div className="space-y-4 p-4">
                    <RoomScene
                      beans={liveRows.filter((r) => r.state === 'focus').map((r) => r.avatar)}
                      night={daypart === 'night'}
                      label={room.name}
                    />
                    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {liveRows.map((m) => (
                        <li key={m.user_id}>
                          <Desk
                            m={m}
                            isMe={m.user_id === me.id}
                            bubble={bubbleFor(m.user_id)}
                            onOpen={() => openById(m.user_id)}
                          />
                        </li>
                      ))}
                      {Array.from({ length: deskSlots }, (_, i) => (
                        <li key={`free-${i}`} className={freeClass(i)}>
                          <EmptyDesk />
                        </li>
                      ))}
                    </ul>
                  </div>
                }
              />
            )}
            {bannerText && (
              <p className="border-t-2 border-line bg-surface-2 px-4 py-2 font-bold" role="status">
                {bannerText}
              </p>
            )}
          </div>
          {onlineIdle.length > 0 && (
            <p className="text-sm text-on-bg-muted">{t.onlineIdle(onlineIdle.map((m) => m.display_name))}</p>
          )}
          {sharedPhase?.phase === 'break' && <p className="font-bold">{copy.sync.breakHint}</p>}
          <div className="flex flex-wrap gap-2" role="group" aria-label={t.reactions}>
            {REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={`btn min-w-12 text-xl ${sharedPhase?.phase === 'break' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => react(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </section>

        <div className="space-y-5">
          <TimerDock roomId={room.id} sync={sync} together={studyingIds.length} radio={station} />
          <section className="card p-4">
            <div role="tablist" className="grid grid-cols-3 gap-2">
              {(['leaderboard', 'radio', 'members'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  aria-selected={tab === k}
                  className={`chip ${tab === k ? 'chip-on' : ''}`}
                  onClick={() => setTab(k)}
                >
                  {t.tabs[k]}
                </button>
              ))}
            </div>
            <div className="mt-4">
              {tab === 'leaderboard' ? (
                <Leaderboard
                  roomId={room.id}
                  meId={me.id}
                  refreshKey={liveRows.length + studyingIds.length}
                />
              ) : tab === 'radio' ? (
                <RadioPanel
                  roomId={room.id}
                  station={station}
                  canPick={myRole === 'owner' || myRole === 'mod'}
                  onPick={(id) => void pickStation(id)}
                />
              ) : (
                <MembersList members={members ?? []} live={byId} now={now} onOpen={(m) => setOpenMember(m)} />
              )}
            </div>
          </section>
        </div>
      </div>

      {openMember && (
        <MemberSheet
          roomId={room.id}
          member={openMember}
          myRole={myRole}
          meId={me.id}
          nudgeMuted={sharedPhase?.phase === 'focus'}
          statusLine={
            byId.get(openMember.user_id)?.state === 'focus' ? byId.get(openMember.user_id)?.status_line : null
          }
          onNudge={() => {
            if (nudge(openMember.user_id)) toast(`${copy.room.nudge} → ${openMember.display_name}`)
          }}
          onClose={() => setOpenMember(null)}
          onChanged={() => {
            setMembersKey((k) => k + 1)
            refresh()
          }}
        />
      )}

      {sheet === 'menu' && (
        <Dialog title={room.name} onClose={() => setSheet(null)} labelledBy="menu-title">
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              className="btn btn-secondary justify-start"
              onClick={() => void copyInvite()}
            >
              {t.copyLink}
            </button>
            <label className="card flex items-start gap-3 p-3">
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 accent-[var(--accent)]"
                checked={notifyOn ?? info?.notifyActive ?? false}
                onChange={(e) => void toggleNotify(e.target.checked)}
              />
              <span>
                <span className="block font-bold">{copy.push.roomToggle}</span>
                <span className="text-sm text-muted">{copy.push.roomToggleHint}</span>
              </span>
            </label>
            <p className="inline-flex items-center gap-2 font-bold" data-testid="room-bank">
              <CoinIcon /> {copy.coins.bank(info?.bank ?? 0)}
            </p>
            <button
              type="button"
              className="btn btn-secondary justify-start"
              onClick={() => setSheet('donate')}
            >
              {copy.coins.donate}
            </button>
            {(myRole === 'owner' || myRole === 'mod') && (
              <>
                <Link to={`/room/${room.id}/decorate`} className="btn btn-secondary justify-start">
                  {copy.decor.editRoom}
                </Link>
                <Link to={`/room/${room.id}/shop`} className="btn btn-secondary justify-start">
                  {copy.decor.roomShop}
                </Link>
              </>
            )}
            {(myRole === 'owner' || myRole === 'mod') && (
              <button
                type="button"
                className="btn btn-secondary justify-start"
                onClick={() => setSheet('settings')}
              >
                {t.settings}
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary justify-start text-danger"
              onClick={() => setSheet('leave')}
            >
              {t.leave}
            </button>
          </div>
        </Dialog>
      )}
      {sheet === 'settings' && (
        <RoomSettings
          roomId={room.id}
          name={room.name}
          sync={sync}
          onSyncChanged={refetchInfo}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'donate' && (
        <DonateDialog
          roomId={room.id}
          onClose={() => setSheet(null)}
          onDone={() => {
            setSheet(null)
            refetchInfo()
          }}
        />
      )}
      {sheet === 'leave' && (
        <Dialog title={t.leave} onClose={() => setSheet(null)} labelledBy="leave-title">
          <p className="mt-3">{t.leaveConfirm}</p>
          <ErrorText code={error} />
          <div className="mt-5 flex gap-3">
            <button type="button" className="btn btn-secondary" onClick={() => setSheet(null)}>
              {copy.home.cancel}
            </button>
            <button type="button" className="btn btn-primary flex-1" onClick={() => void doLeave()}>
              {t.leave}
            </button>
          </div>
        </Dialog>
      )}

      {phase.name === 'ended' && (
        <NoteDialog
          key={phase.session.id}
          sessionId={phase.session.id}
          focusSeconds={phase.session.focus_seconds ?? 0}
          kind={phase.session.kind}
          plannedSeconds={phase.session.planned_seconds}
          onClose={() => {
            void afterEnded({ shared: sync !== null })
            refresh()
          }}
        />
      )}
    </div>
  )
}

/** The accessible list behind the scene: who's here now (with their timer), then everyone else. */
function MembersList({
  members,
  live,
  now,
  onOpen,
}: {
  members: RoomMember[]
  live: ReadonlyMap<string, LiveMember>
  now: number
  onOpen: (m: RoomMember) => void
}) {
  const here = members.filter((m) => live.has(m.user_id))
  const rest = members.filter((m) => !live.has(m.user_id))
  const row = (m: RoomMember) => {
    const l = live.get(m.user_id)
    const clock = l ? liveClock(l, now) : null
    return (
      <li key={m.user_id}>
        <button
          type="button"
          className="flex w-full items-center gap-3 py-2 text-left"
          onClick={() => onOpen(m)}
        >
          {clock && (
            <span
              className={`h-3 w-3 shrink-0 rounded-full border-2 border-line ${clock.focusing ? 'bg-good' : 'bg-rest'}`}
              aria-label={clock.focusing ? t.focusingLabel : t.onBreak}
            />
          )}
          <span className="min-w-0">
            <span className="font-bold">{m.display_name}</span>{' '}
            <span className="text-sm text-muted">@{m.handle}</span>
            {l?.state === 'focus' && l.status_line && (
              <span className="block truncate text-sm text-muted">{l.status_line}</span>
            )}
          </span>
          {m.role !== 'member' && (
            <span className="pill">
              {m.role === 'owner' ? copy.profileSheet.roleOwner : copy.profileSheet.roleMod}
            </span>
          )}
          {clock && <span className="font-display ml-auto font-bold tabular-nums">{clock.clock}</span>}
        </button>
      </li>
    )
  }
  return (
    <div className="space-y-3">
      {here.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-muted">{t.presentNow}</h3>
          <ul className="divide-y-2 divide-surface-2">{here.map(row)}</ul>
        </div>
      )}
      <div>
        {here.length > 0 && <h3 className="text-sm font-bold text-muted">{t.everyone}</h3>}
        <ul className="divide-y-2 divide-surface-2">{rest.map(row)}</ul>
      </div>
    </div>
  )
}
