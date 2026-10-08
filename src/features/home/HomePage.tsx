import { APP_NAME } from '../../config'
import { copy } from '../../content/copy'
import { useDaypart } from '../../components/useDaypart'

export function HomePage() {
  const daypart = useDaypart()

  return (
    <div className="space-y-8">
      <header>
        <h1 className="font-display text-4xl font-bold md:hidden">{APP_NAME}</h1>
        <p className="mt-1 text-lg text-[var(--on-bg-muted)]">{copy.home.greeting[daypart]}</p>
      </header>

      <section aria-labelledby="rooms-heading" className="space-y-4">
        <h2 id="rooms-heading" className="font-display text-xl font-bold">
          {copy.home.roomsHeading}
        </h2>
        <div className="card card-raised p-6">
          <h3 className="font-display text-2xl font-bold">{copy.home.emptyTitle}</h3>
          <p className="mt-2 max-w-prose text-muted">{copy.home.emptyBody}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary" disabled title={copy.home.comingSoon}>
              {copy.home.createRoom}
            </button>
            <button type="button" className="btn btn-secondary" disabled title={copy.home.comingSoon}>
              {copy.home.joinWithCode}
            </button>
          </div>
          <p className="mt-3 text-sm text-muted">{copy.home.comingSoon}</p>
        </div>
      </section>
    </div>
  )
}
