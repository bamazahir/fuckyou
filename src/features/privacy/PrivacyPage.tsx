import { Link } from 'react-router-dom'
import { Screen } from '../../components/Screen'
import { copy } from '../../content/copy'

// Plain-language privacy page (SPEC §13). Keep it in step with the tables in supabase/migrations.
const SECTIONS: { h: string; p: string[] }[] = [
  {
    h: 'What Studyroom is',
    p: [
      'A study timer where friends can see each other studying in shared rooms. It is built by a student, for students. There are no ads and we never sell data.',
    ],
  },
  {
    h: 'What we collect',
    p: [
      'Your email address, only to sign you in. Nobody else sees it.',
      'Your handle, display name and cartoon avatar (colors and hairstyle).',
      'Your country and an age range (not your birthday), so we know whether a parent needs to agree first.',
      'Your study sessions: when they started, how long they were, what you wrote as your status line, and any note you add afterwards.',
      'The rooms you are in, people you block, and reports you send.',
      'Simple usage counts (for example “a session was completed”), with no free text in them.',
      'If a parent agreed for you: when they agreed, and a scrambled (hashed) copy of their email address.',
    ],
  },
  {
    h: 'Who sees what',
    p: [
      'People in a room with you see your display name, handle, avatar, your status line while you study, and your minutes on that room’s leaderboards.',
      'Your notes are private to you. Nobody outside a room can see who is in it, except a short preview (room name, member count, and who is studying right now) shown to anyone with the invite link.',
      'The builder of Studyroom can see reports and act on them, and can see overall usage numbers. Numbers used in a university application are totals only, never names or notes.',
    ],
  },
  {
    h: 'Services we use',
    p: [
      'Supabase stores the data and runs sign-in. Vercel serves the app. Resend sends the parent-consent email. Fonts and everything else are served by Studyroom itself; there are no trackers or analytics companies.',
    ],
  },
  {
    h: 'Your choices',
    p: [
      'Download everything we have about you from Profile → Download my data.',
      'Delete your account from Profile → Delete my account. It is removed for good straight away, including sessions and notes. Rooms you own pass to another member.',
      'Usage counts that no longer point to a person are kept for up to 400 days, then deleted.',
    ],
  },
  {
    h: 'Children and parents',
    p: [
      'Studyroom is for ages 13 and up. Where the law asks for it (for example under 16 in Germany or the Netherlands), a parent or guardian must agree by email first. If nobody answers within 7 days, the account is deleted. A parent can withdraw at any time from the link in that email, which deletes the account.',
    ],
  },
]

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
