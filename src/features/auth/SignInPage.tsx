import { useState, type FormEvent } from 'react'
import { Screen } from '../../components/Screen'
import { APP_NAME } from '../../config'
import { copy } from '../../content/copy'
import { supabase } from '../../lib/supabase'

export function SignInPage() {
  const [email, setEmail] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const redirectTo = `${window.location.origin}/`

  async function google() {
    setFailed(false)
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } })
    if (error) setFailed(true)
  }

  async function sendLink(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setFailed(false)
    const address = email.trim()
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: redirectTo },
    })
    setBusy(false)
    if (error) setFailed(true)
    else setSentTo(address)
  }

  return (
    <Screen>
      <h1 className="font-display text-4xl font-bold">{APP_NAME}</h1>
      <p className="mt-2 text-lg text-on-bg-muted">{copy.signIn.lead}</p>
      <div className="card card-raised mt-8 p-6">
        <h2 className="font-display text-2xl font-bold">{copy.signIn.title}</h2>
        {sentTo ? (
          <p className="mt-4" role="status">
            {copy.signIn.sent(sentTo)}
          </p>
        ) : (
          <>
            <button type="button" className="btn btn-primary mt-5 w-full" onClick={google}>
              {copy.signIn.google}
            </button>
            <p className="my-4 text-center text-sm text-muted">{copy.signIn.or}</p>
            <form onSubmit={sendLink} className="space-y-3">
              <label className="block text-sm font-bold" htmlFor="email">
                {copy.signIn.emailLabel}
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={copy.signIn.emailPlaceholder}
                className="field"
              />
              <button type="submit" className="btn btn-secondary w-full" disabled={busy}>
                {copy.signIn.emailButton}
              </button>
            </form>
          </>
        )}
        {failed && (
          <p role="alert" className="mt-3 text-sm font-bold text-danger">
            {copy.errors.generic}
          </p>
        )}
        <p className="mt-5 text-sm text-muted">{copy.signIn.privacy}</p>
      </div>
    </Screen>
  )
}
