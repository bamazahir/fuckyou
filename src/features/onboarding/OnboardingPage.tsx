import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bean } from '../../components/Bean'
import { ErrorText, Screen } from '../../components/Screen'
import { AVATAR_SLOTS, randomAvatar } from '../../content/avatar'
import consentTable from '../../content/consent-ages.json'
import { copy } from '../../content/copy'
import { COUNTRY_CODES } from '../../content/countries'
import { AGE_BRACKETS, consentStatusFor, type AgeBracket } from '../../core/consent'
import { displayNameError, handleError, normalizeHandle } from '../../core/validate'
import type { Avatar } from '../../lib/db'
import { rpcErrorCode, supabase } from '../../lib/supabase'
import { useAuth } from '../../stores/auth'

const t = copy.onboarding

function guessCountry(): string {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region
    return region && (COUNTRY_CODES as readonly string[]).includes(region) ? region : ''
  } catch {
    return ''
  }
}

function StepHeader({ n, title }: { n: number; title: string }) {
  return (
    <>
      <p className="text-sm font-bold text-muted">{t.step(n, 3)}</p>
      <h1 className="font-display mt-1 text-2xl font-bold">{title}</h1>
    </>
  )
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const reload = useAuth((s) => s.reload)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [country, setCountry] = useState(guessCountry)
  const [bracket, setBracket] = useState<AgeBracket | null>(null)
  const [handle, setHandle] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [avatar, setAvatar] = useState<Avatar>(() => randomAvatar())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const countries = useMemo(() => {
    const names = new Intl.DisplayNames([navigator.language, 'en'], { type: 'region' })
    return COUNTRY_CODES.map((code) => ({ code, name: names.of(code) ?? code })).sort((a, b) =>
      a.name.localeCompare(b.name),
    )
  }, [])

  async function submitAge(e: FormEvent) {
    e.preventDefault()
    if (!bracket || !country) return
    if (consentStatusFor(bracket, country, consentTable) === 'blocked') {
      setBusy(true)
      await supabase.rpc('reject_underage')
      // Leave the gated route first; signing out while still here would redirect to /signin.
      navigate('/blocked', { replace: true })
      window.setTimeout(() => void supabase.auth.signOut({ scope: 'local' }), 0)
      return
    }
    setStep(2)
  }

  const handleProblem = handle ? handleError(handle) : null
  const nameProblem = displayName ? displayNameError(displayName) : null

  async function finish() {
    if (!bracket) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.rpc('complete_profile', {
      p_handle: normalizeHandle(handle),
      p_display_name: displayName.trim(),
      p_country: country,
      p_age_bracket: bracket,
      p_avatar: avatar,
      p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
    setBusy(false)
    if (err) {
      const code = rpcErrorCode(err)
      setError(code)
      if (code === 'handle_taken' || code === 'invalid_handle') setStep(2)
      return
    }
    void supabase.rpc('log_event', { p_name: 'onboarding_done', p_props: {} })
    await reload()
    navigate('/', { replace: true })
  }

  return (
    <Screen>
      <div className="card card-raised p-6">
        {step === 1 && (
          <form onSubmit={submitAge}>
            <StepHeader n={1} title={t.age.title} />
            <label htmlFor="country" className="mt-5 block text-sm font-bold">
              {t.age.countryLabel}
            </label>
            <select
              id="country"
              required
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="field mt-1"
            >
              <option value="" disabled>
                —
              </option>
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>
            <fieldset className="mt-5">
              <legend className="text-sm font-bold">{t.age.ageLabel}</legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {AGE_BRACKETS.map((b) => (
                  <label key={b} className={`chip ${bracket === b ? 'chip-on' : ''}`}>
                    <input
                      type="radio"
                      name="age"
                      value={b}
                      checked={bracket === b}
                      onChange={() => setBracket(b)}
                      className="sr-only"
                    />
                    {t.age.brackets[b]}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="mt-4 text-sm text-muted">{t.age.why}</p>
            <button
              type="submit"
              className="btn btn-primary mt-5 w-full"
              disabled={!bracket || !country || busy}
            >
              {copy.common.next}
            </button>
          </form>
        )}

        {step === 2 && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!handleError(handle) && !displayNameError(displayName)) setStep(3)
            }}
          >
            <StepHeader n={2} title={t.name.title} />
            <label htmlFor="handle" className="mt-5 block text-sm font-bold">
              {t.name.handleLabel}
            </label>
            <div className="field mt-1 flex items-center gap-1 focus-within:outline-3 focus-within:outline-lamp">
              <span className="text-muted">@</span>
              <input
                id="handle"
                required
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                aria-describedby="handle-hint"
                aria-invalid={handleProblem !== null}
                className="w-full bg-transparent outline-none"
              />
            </div>
            <p id="handle-hint" className="mt-1 text-sm text-muted">
              {handleProblem ? t.name.errors[handleProblem] : t.name.handleHint}
            </p>
            <label htmlFor="display" className="mt-4 block text-sm font-bold">
              {t.name.displayLabel}
            </label>
            <input
              id="display"
              required
              autoComplete="nickname"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              aria-describedby="display-hint"
              aria-invalid={nameProblem !== null}
              className="field mt-1"
            />
            <p id="display-hint" className="mt-1 text-sm text-muted">
              {nameProblem ? t.name.errors[nameProblem] : t.name.displayHint}
            </p>
            <ErrorText code={error} />
            <div className="mt-5 flex gap-3">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
                {copy.common.back}
              </button>
              <button
                type="submit"
                className="btn btn-primary flex-1"
                disabled={!handle || !displayName || handleProblem !== null || nameProblem !== null}
              >
                {copy.common.next}
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <div>
            <StepHeader n={3} title={t.bean.title} />
            <div className="mt-4 flex justify-center">
              <Bean colors={avatar.colors} size={110} title={displayName} />
            </div>
            {AVATAR_SLOTS.map((slot) => (
              <fieldset key={slot.key} className="mt-4">
                <legend className="text-sm font-bold">{t.bean[slot.key]}</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {slot.swatches.map((hex) => (
                    <label key={hex} className="swatch" style={{ backgroundColor: hex }}>
                      <input
                        type="radio"
                        name={slot.key}
                        value={hex}
                        checked={avatar.colors[slot.key] === hex}
                        onChange={() =>
                          setAvatar({ ...avatar, colors: { ...avatar.colors, [slot.key]: hex } })
                        }
                        className="sr-only"
                        aria-label={`${t.bean[slot.key]} ${hex}`}
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
            <ErrorText code={error} />
            <div className="mt-6 flex flex-wrap gap-3">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>
                {copy.common.back}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setAvatar(randomAvatar())}>
                {t.bean.randomize}
              </button>
              <button type="button" className="btn btn-primary flex-1" onClick={finish} disabled={busy}>
                {t.bean.finish}
              </button>
            </div>
          </div>
        )}
      </div>
    </Screen>
  )
}
