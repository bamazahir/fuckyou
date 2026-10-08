import { Link } from 'react-router-dom'
import { Bean } from '../../components/Bean'
import { useDaypart } from '../../components/useDaypart'
import { copy } from '../../content/copy'
import { useAuth } from '../../stores/auth'

export function HomePage() {
  const daypart = useDaypart()
  const profile = useAuth((s) => s.profile)
  const personalRoomId = useAuth((s) => s.personalRoomId)

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl font-bold">
          {profile ? copy.home.hi(profile.display_name) : ''}
        </h1>
        <p className="mt-1 text-lg text-[var(--on-bg-muted)]">{copy.home.greeting[daypart]}</p>
      </header>

      {personalRoomId && profile && (
        <section className="card card-raised flex items-center gap-5 p-5">
          <Bean colors={profile.avatar.colors} size={72} title={profile.display_name} />
          <div className="flex-1">
            <h2 className="font-display text-2xl font-bold">{copy.home.soloTitle}</h2>
            <p className="text-muted">{copy.home.soloBody}</p>
            <Link to={`/room/${personalRoomId}`} className="btn btn-primary mt-3">
              {copy.home.soloButton}
            </Link>
          </div>
        </section>
      )}

      <section aria-labelledby="rooms-heading" className="space-y-4">
        <h2 id="rooms-heading" className="font-display text-xl font-bold">
          {copy.home.roomsHeading}
        </h2>
        <div className="card p-6">
          <h3 className="font-display text-xl font-bold">{copy.home.emptyTitle}</h3>
          <p className="mt-2 max-w-prose text-muted">{copy.home.emptyBody}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" className="btn btn-secondary" disabled title={copy.home.comingSoon}>
              {copy.home.createRoom}
            </button>
            <button type="button" className="btn btn-secondary" disabled title={copy.home.comingSoon}>
              {copy.home.joinWithCode}
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
