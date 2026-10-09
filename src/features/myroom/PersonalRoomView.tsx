import { RoomScene } from '../../components/RoomScene'
import { useDaypart } from '../../components/useDaypart'
import { copy } from '../../content/copy'
import { DEFAULT_PERSONAL, PERSONAL_SIZE } from '../../content/layouts'
import { useAuth } from '../../stores/auth'
import { useTimer } from '../../stores/timer'
import { RoomView } from '../room/RoomView'

/** Your personal room, with your bean at the desk: writing while you focus, mug in hand on a break. */
export function PersonalRoomView({ className }: { className: string }) {
  const profile = useAuth((s) => s.profile)
  const personalRoomId = useAuth((s) => s.personalRoomId)
  const daypart = useDaypart()
  const phase = useTimer((s) => s.phase)
  if (!profile) return null
  const focusing = phase.name === 'running' && phase.session.room_id === personalRoomId
  const state = focusing ? 'focus' : phase.name === 'break' ? 'break' : 'idle'
  const stateLabel =
    state === 'focus' ? copy.room.focusingLabel : state === 'break' ? copy.room.onBreak : copy.room.presentNow
  return (
    <RoomView
      className={className}
      size={PERSONAL_SIZE}
      layout={DEFAULT_PERSONAL}
      walkIn={false}
      avatars={[
        {
          id: profile.id,
          name: profile.display_name,
          avatar: profile.avatar,
          state,
          clock: null,
          isMe: true,
          ariaLabel: `${profile.display_name}, ${stateLabel}`,
        },
      ]}
      night={daypart === 'night'}
      lampOn={focusing || daypart === 'night'}
      label={copy.myRoom.sceneLabel(profile.display_name)}
      fallback={
        <RoomScene
          beans={[profile.avatar]}
          night={daypart === 'night'}
          lampOn={focusing || daypart === 'night'}
          label={copy.myRoom.title}
        />
      }
    />
  )
}
