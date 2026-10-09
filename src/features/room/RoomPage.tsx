import { useEffect, useState } from 'react'
import { Navigate, useParams } from 'react-router-dom'
import { copy } from '../../content/copy'
import { useAuth } from '../../stores/auth'
import { useRooms } from '../../stores/rooms'
import { useTimer } from '../../stores/timer'
import { PersonalRoomView } from '../myroom/PersonalRoomView'
import { NotFoundPage } from '../NotFoundPage'
import { NoteDialog } from './NoteDialog'
import { SharedRoom } from './SharedRoom'
import { TimerDock } from './TimerDock'
import { STATIONS } from '../../content/stations'
import { resolveStation } from '../../core/radio'
import { personalStation, savePersonalStation } from '../../stores/radio'
import { RadioPanel } from '../radio/RadioPanel'
import { useRoomRadio } from '../radio/useRoomRadio'

function SoloRoom({ roomId }: { roomId: string }) {
  const profile = useAuth((s) => s.profile)
  const { phase, afterEnded } = useTimer()
  const [stationId, setStationId] = useState(personalStation)
  const station = resolveStation(STATIONS, stationId)
  useRoomRadio(roomId, station)
  if (!profile) return null
  return (
    <div className="space-y-5">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-bold">{copy.myRoom.title}</h1>
        <span className="pill">{copy.room.soloBadge}</span>
      </header>
      <div className="grid gap-5 lg:grid-cols-[1fr_22rem]">
        <div className="card card-raised self-start overflow-hidden">
          <PersonalRoomView className="h-[min(48svh,440px)] min-h-64 lg:h-[520px]" />
        </div>
        <div className="space-y-5">
          <TimerDock roomId={roomId} radio={station} />
          <section aria-labelledby="radio-title" className="card p-4">
            <h2 id="radio-title" className="font-display mb-3 text-lg font-bold">
              {copy.radio.title}
            </h2>
            <RadioPanel
              roomId={roomId}
              station={station}
              canPick
              personal
              onPick={(id) => {
                setStationId(id)
                savePersonalStation(id)
              }}
            />
          </section>
        </div>
      </div>
      {phase.name === 'ended' && (
        <NoteDialog
          key={phase.session.id}
          sessionId={phase.session.id}
          focusSeconds={phase.session.focus_seconds ?? 0}
          kind={phase.session.kind}
          plannedSeconds={phase.session.planned_seconds}
          onClose={() => void afterEnded()}
        />
      )}
    </div>
  )
}

export function RoomPage() {
  const { roomId } = useParams()
  const personalRoomId = useAuth((s) => s.personalRoomId)
  const { rooms, load } = useRooms()

  useEffect(() => {
    if (rooms === null) void load()
  }, [rooms, load])

  if (!roomId) return <Navigate to="/" replace />
  if (roomId === personalRoomId) return <SoloRoom roomId={roomId} />
  if (rooms === null) return null
  const room = rooms.find((r) => r.id === roomId)
  return room ? <SharedRoom key={room.id} room={room} /> : <NotFoundPage />
}
