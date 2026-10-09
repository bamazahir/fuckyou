import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { copy } from '../../content/copy'
import type { ReportRow } from '../../lib/db'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../stores/auth'
import { AdminMetrics } from './AdminMetrics'

const t = copy.admin
type Action = 'dismiss' | 'remove_content' | 'ban_user' | 'delete_room'

export function AdminPage() {
  const isAdmin = useAuth((s) => s.profile?.is_admin)
  const [reports, setReports] = useState<ReportRow[] | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!isAdmin) return
    let cancelled = false
    void supabase.rpc('admin_list_reports').then(({ data }) => {
      if (!cancelled) setReports((data as ReportRow[] | null) ?? [])
    })
    return () => {
      cancelled = true
    }
  }, [isAdmin, reloadKey])

  if (!isAdmin) return <Navigate to="/" replace />

  async function act(id: number, action: Action, label: string) {
    if (action !== 'dismiss' && !window.confirm(t.confirm(label))) return
    await supabase.rpc('admin_resolve_report', { p_report_id: id, p_action: action })
    setReloadKey((k) => k + 1)
  }

  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-bold">{t.page}</h1>
      <AdminMetrics />
      <div className="space-y-5">
        <h2 className="font-display text-2xl font-bold">{t.title}</h2>
        {reports !== null && reports.length === 0 && <p className="text-on-bg-muted">{t.empty}</p>}
        <ul className="space-y-3">
          {(reports ?? []).map((r) => (
            <li key={r.id} className="card p-4">
              <p className="font-bold">
                {copy.reportSheet.reasons[r.reason as keyof typeof copy.reportSheet.reasons] ?? r.reason} ·{' '}
                {r.target_type}
              </p>
              <p className="text-sm text-muted">
                {r.target_display_name ? `${r.target_display_name} (@${r.target_handle ?? '?'})` : ''}{' '}
                {r.room_name ? `in ${r.room_name}` : ''}
              </p>
              {r.context && <p className="mt-2 rounded-md bg-surface-2 p-2 text-sm">“{r.context}”</p>}
              {r.note && <p className="mt-2 text-sm">{r.note}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-secondary text-sm"
                  onClick={() => void act(r.id, 'dismiss', t.dismiss)}
                >
                  {t.dismiss}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary text-sm"
                  onClick={() => void act(r.id, 'remove_content', t.removeContent)}
                >
                  {t.removeContent}
                </button>
                {r.target_user_id && (
                  <button
                    type="button"
                    className="btn btn-secondary text-sm text-danger"
                    onClick={() => void act(r.id, 'ban_user', t.ban)}
                  >
                    {t.ban}
                  </button>
                )}
                {r.room_id && r.target_type === 'room' && (
                  <button
                    type="button"
                    className="btn btn-secondary text-sm text-danger"
                    onClick={() => void act(r.id, 'delete_room', t.deleteRoom)}
                  >
                    {t.deleteRoom}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
