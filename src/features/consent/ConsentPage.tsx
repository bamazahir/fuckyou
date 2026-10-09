import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ErrorText, Screen } from '../../components/Screen'
import { copy } from '../../content/copy'
import { rpcErrorCode, supabase } from '../../lib/supabase'

const t = copy.consent

interface ConsentInfo {
  child_display_name: string
  state: 'pending' | 'granted' | 'expired'
}

/** The parent's page from the consent email (SPEC §13.1). Public; reveals only the child's display name. */
export function ConsentPage() {
  const { token = '' } = useParams()
  const [params] = useSearchParams()
  const withdrawMode = params.get('withdraw') === '1'
  const [info, setInfo] = useState<ConsentInfo | null>(null)
  const [result, setResult] = useState<'granted' | 'deleted' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void supabase.rpc('consent_view', { p_token: token }).then(({ data, error: err }) => {
      if (cancelled) return
      if (err) setError(rpcErrorCode(err))
      else setInfo(data as ConsentInfo)
    })
    return () => {
      cancelled = true
    }
  }, [token])

  async function decide(decision: 'grant' | 'decline' | 'withdraw') {
    const { data, error: err } = await supabase.rpc('consent_decide', {
      p_token: token,
      p_decision: decision,
    })
    if (err) return setError(rpcErrorCode(err))
    setResult(data as 'granted' | 'deleted')
  }

  return (
    <Screen>
      <div className="card card-raised p-6">
        {result === 'granted' && <p className="font-display text-xl font-bold">{t.granted}</p>}
        {result === 'deleted' && <p className="font-display text-xl font-bold">{t.deleted}</p>}
        {!result && info && (
          <>
            <h1 className="font-display text-2xl font-bold">{t.title(info.child_display_name)}</h1>
            <p className="mt-3">{t.lead}</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
              {t.collect.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <Link to="/privacy" className="mt-3 inline-block text-sm font-bold underline">
              {t.privacy}
            </Link>
            {info.state === 'expired' && <p className="mt-5 font-bold">{t.expired}</p>}
            {info.state === 'pending' && !withdrawMode && (
              <div className="mt-6 flex flex-col gap-3">
                <button type="button" className="btn btn-primary" onClick={() => void decide('grant')}>
                  {t.agree}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => void decide('decline')}>
                  {t.decline}
                </button>
              </div>
            )}
            {(info.state === 'granted' || withdrawMode) && info.state !== 'expired' && (
              <button
                type="button"
                className="btn btn-secondary mt-6 text-danger"
                onClick={() => void decide('withdraw')}
              >
                {t.withdraw}
              </button>
            )}
          </>
        )}
        <ErrorText code={error} />
      </div>
    </Screen>
  )
}
