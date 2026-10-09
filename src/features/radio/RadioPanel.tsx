import { PauseIcon, PlayIcon, SpeakerIcon } from '../../components/icons'
import { rovingKeys } from '../../components/roving'
import { copy } from '../../content/copy'
import { STATION_EPOCH_MS, STATIONS } from '../../content/stations'
import { formatClock } from '../../core/time'
import { isPlayable, radioPosition, type Station } from '../../core/radio'
import { useRadio } from '../../stores/radio'
import { useNow } from '../../components/useNow'

const t = copy.radio

/** The compact pill in the timer dock: the station's emoji and name, tap to play or pause. */
export function RadioPill({ roomId, station }: { roomId: string; station: Station }) {
  const { playing, play, pause } = useRadio()
  const here = useRadio((s) => s.roomId === roomId)
  const on = here && playing
  if (station.kind === 'silence') return null
  return (
    <button
      type="button"
      className={`pill gap-1.5 ${on ? 'bg-accent text-on-accent' : ''}`}
      onClick={() => (on ? pause() : void play(roomId, station))}
      aria-label={t.pill(station.name, on)}
    >
      <span aria-hidden="true">{station.emoji}</span>
      {station.name}
      {on ? <PauseIcon width={14} height={14} /> : <PlayIcon width={14} height={14} />}
    </button>
  )
}

/** Now playing (SPEC §11): station art, title, artist, progress, volume and mute; the picker for owners. */
export function RadioPanel({
  roomId,
  station,
  canPick,
  onPick,
  personal = false,
}: {
  roomId: string
  station: Station
  canPick: boolean
  onPick: (id: string) => void
  personal?: boolean
}) {
  const { playing, play, pause, volume, muted, setVolume, toggleMute } = useRadio()
  const here = useRadio((s) => s.roomId === roomId)
  const on = here && playing
  const clock = useNow(on && station.kind === 'tracks')
  const pos = on && station.kind === 'tracks' ? radioPosition(clock, STATION_EPOCH_MS, station.tracks) : null
  const track = pos && station.kind === 'tracks' ? station.tracks[pos.index] : undefined
  const line =
    station.kind === 'silence' ? t.silenceLine : station.kind === 'generated' ? t.generatedLine : null

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div
          className="grid size-20 shrink-0 place-items-center rounded-2xl border-2 border-line bg-accent text-4xl"
          aria-hidden="true"
        >
          {station.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-bold">{station.name}</p>
          {track ? (
            <p className="truncate text-sm">
              {track.title} · <span className="text-muted">{track.artist}</span>
            </p>
          ) : (
            line && <p className="text-sm text-muted">{line}</p>
          )}
          {track && pos && (
            <div className="mt-2">
              <div
                className="h-2 overflow-hidden rounded-full border border-line bg-surface-2"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={track.duration_s}
                aria-valuenow={Math.round(pos.offsetS)}
                aria-label={track.title}
              >
                <div
                  className="h-full bg-accent"
                  style={{ width: `${(pos.offsetS / track.duration_s) * 100}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-muted tabular-nums">
                {formatClock(Math.floor(pos.offsetS))} / {formatClock(track.duration_s)}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="btn btn-primary size-12 shrink-0 p-0"
          onClick={() => (on ? pause() : void play(roomId, station))}
          disabled={station.kind === 'silence'}
          aria-label={on ? t.pause : t.play}
        >
          {on ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button
          type="button"
          className="btn btn-secondary size-12 shrink-0 p-0"
          onClick={toggleMute}
          aria-label={muted ? t.unmute : t.mute}
          aria-pressed={muted}
        >
          <SpeakerIcon muted={muted || volume === 0} />
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label={t.volume}
          className="h-2 flex-1 accent-[var(--accent)]"
        />
      </div>

      <fieldset>
        <legend className="text-sm font-bold">{t.stations}</legend>
        <p className="text-sm text-muted">
          {canPick ? (personal ? t.personalHint : t.pickHint) : t.ownerPicks}
        </p>
        <div role="radiogroup" aria-label={t.stations} className="mt-2 grid grid-cols-2 gap-2">
          {STATIONS.map((s) => {
            const playable = isPlayable(s)
            return (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={s.id === station.id}
                tabIndex={s.id === station.id ? 0 : -1}
                onKeyDown={rovingKeys}
                className={`chip justify-start gap-2 ${s.id === station.id ? 'chip-on' : ''}`}
                disabled={!canPick || !playable}
                onClick={() => {
                  onPick(s.id)
                  if (on) void play(roomId, s)
                }}
              >
                <span aria-hidden="true">{s.emoji}</span>
                <span className="truncate">{s.name}</span>
                {!playable && <span className="ml-auto text-xs text-muted">{t.comingSoon}</span>}
              </button>
            )
          })}
        </div>
      </fieldset>
    </div>
  )
}
