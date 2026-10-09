import { useState, type FormEvent } from 'react'
import { ErrorText, Screen } from '../../components/Screen'
import { copy } from '../../content/copy'
import { rpcErrorCode, supabase } from '../../lib/supabase'
import { useAuth } from '../../stores/auth'

const t = copy.waiting

/** Pending accounts ask a parent or guardian by email (SPEC §13.1). */
export function WaitingPage() {
  const signOut = useAuth((s) => s.signOut)
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function send(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('request_parental_consent', { p_parent_email: email.trim() })
    setBusy(false)
    if (err) return setError(rpcErrorCode(err))
    setSentTo(email.trim())
  }

  async function deleteInstead() {
    setError(null)
    const { error: err } = await supabase.rpc('delete_my_account')
    if (err) return setError(rpcErrorCode(err))
    await signOut()
  }

  return (
    <Screen>
      <div className="card card-raised p-6">
        <h1 className="font-display text-2xl font-bold">{t.title}</h1>
        <p className="mt-3">{t.body}</p>
        <form onSubmit={send} className="mt-5">
          <label htmlFor="parent-email" className="block text-sm font-bold">
            {t.emailLabel}
          </label>
          <input
            id="parent-email"
            type="email"
            required
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field mt-1"
          />
          <button type="submit" className="btn btn-primary mt-3 w-full" disabled={busy}>
            {sentTo ? t.resend : t.send}
          </button>
        </form>
        {sentTo && (
          <p className="mt-3 text-sm" role="status">
            {t.sent(sentTo)}
          </p>
        )}
        <ErrorText code={error} />
        <p className="mt-4 text-sm text-muted">{t.expiry}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => void signOut()}>
            {copy.common.signOut}
          </button>
          <button
            type="button"
            className="btn btn-secondary text-danger"
            onClick={() => void deleteInstead()}
          >
            {t.deleteInstead}
          </button>
        </div>
      </div>
    </Screen>
  )
}
