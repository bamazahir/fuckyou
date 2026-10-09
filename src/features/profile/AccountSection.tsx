import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Dialog } from '../../components/Dialog'
import { copy } from '../../content/copy'
import { ErrorText } from '../../components/Screen'
import { rpcErrorCode, supabase } from '../../lib/supabase'
import { useAuth } from '../../stores/auth'
import { useRooms } from '../../stores/rooms'

const t = copy.profile

interface BlockedPerson {
  blocked_id: string
}

export function AccountSection() {
  const profile = useAuth((s) => s.profile)
  const signOut = useAuth((s) => s.signOut)
  const { blocked, loadBlocks, unblock } = useRooms()
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rows: BlockedPerson[] = [...blocked].map((id) => ({ blocked_id: id }))

  useEffect(() => {
    void loadBlocks()
  }, [loadBlocks])

  async function exportData() {
    setError(null)
    setBusy(true)
    const { data, error: err } = await supabase.rpc('export_my_data')
    setBusy(false)
    if (err || !data) return setError(rpcErrorCode(err) ?? 'generic')
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = 'studyroom-my-data.json'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  async function deleteAccount() {
    setError(null)
    setBusy(true)
    const { error: err } = await supabase.rpc('delete_my_account')
    setBusy(false)
    // Only sign out once the server has really deleted it; otherwise say so and stay.
    if (err) return setError(rpcErrorCode(err))
    await signOut()
  }

  async function toggleBlock(id: string) {
    const err = await unblock(id)
    if (err) setError(err)
  }

  if (!profile) return null
  return (
    <section aria-labelledby="account-heading" className="card p-5">
      <h2 id="account-heading" className="font-display text-xl font-bold">
        {t.account}
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary" onClick={() => void exportData()} disabled={busy}>
          {t.export}
        </button>
        <Link to="/privacy" className="btn btn-secondary">
          {t.privacy}
        </Link>
        {profile.is_admin && (
          <Link to="/admin" className="btn btn-secondary">
            {t.admin}
          </Link>
        )}
        <button type="button" className="btn btn-secondary" onClick={() => void signOut()}>
          {copy.common.signOut}
        </button>
        <button type="button" className="btn btn-secondary text-danger" onClick={() => setConfirming(true)}>
          {t.deleteAccount}
        </button>
      </div>
      {!confirming && <ErrorText code={error} />}

      <h3 className="font-display mt-5 font-bold">{t.blocked}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{t.noneBlocked}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {rows.map((r) => (
            <li key={r.blocked_id} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted">{r.blocked_id.slice(0, 8)}…</span>
              <button
                type="button"
                className="btn btn-secondary min-h-9 text-sm"
                onClick={() => void toggleBlock(r.blocked_id)}
              >
                {copy.room.unblock}
              </button>
            </li>
          ))}
        </ul>
      )}

      {confirming && (
        <Dialog title={t.deleteAccount} onClose={() => setConfirming(false)} labelledBy="delete-title">
          <p className="mt-3">{t.deleteConfirm(profile.handle)}</p>
          <input
            aria-label={profile.handle}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoCapitalize="none"
            className="field mt-3"
          />
          <ErrorText code={error} />
          <div className="mt-5 flex gap-3">
            <button type="button" className="btn btn-secondary" onClick={() => setConfirming(false)}>
              {copy.home.cancel}
            </button>
            <button
              type="button"
              className="btn btn-primary flex-1"
              disabled={busy || typed.trim().toLowerCase() !== profile.handle}
              onClick={() => void deleteAccount()}
            >
              {t.deleteButton}
            </button>
          </div>
        </Dialog>
      )}
    </section>
  )
}
