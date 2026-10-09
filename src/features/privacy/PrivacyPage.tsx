import { Link } from 'react-router-dom'
import { Screen } from '../../components/Screen'
import { copy } from '../../content/copy'

// Plain-language privacy page (SPEC §13). The text lives in copy.ts (privacy.sections); keep it in step
// with the tables in supabase/migrations.
const SECTIONS = copy.privacy.sections

export function PrivacyPage() {
  return (
    <Screen>
      <article className="card card-raised p-6">
        <h1 className="font-display text-3xl font-bold">{copy.privacy.title}</h1>
        <p className="text-sm text-muted">{copy.privacy.updated}</p>
        {SECTIONS.map((s) => (
          <section key={s.h} className="mt-5">
            <h2 className="font-display text-xl font-bold">{s.h}</h2>
            {s.p.map((line) => (
              <p key={line} className="mt-2 max-w-prose">
                {line}
              </p>
            ))}
          </section>
        ))}
        <Link to="/" className="btn btn-secondary mt-6">
          {copy.notFound.back}
        </Link>
      </article>
    </Screen>
  )
}
