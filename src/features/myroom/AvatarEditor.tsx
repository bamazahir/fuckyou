import { useState } from 'react'
import { AvatarSwatches } from '../../components/AvatarSwatches'
import { Bean } from '../../components/Bean'
import { Dialog } from '../../components/Dialog'
import { ErrorText } from '../../components/Screen'
import { copy } from '../../content/copy'
import type { Avatar } from '../../lib/db'
import { useAuth } from '../../stores/auth'
import { useUi } from '../../stores/ui'

/** Colors-only bean editor (SPEC §15 M4). Accessories arrive with the shop in M5. */
export function AvatarEditor({ onClose }: { onClose: () => void }) {
  const profile = useAuth((s) => s.profile)
  const updateAvatar = useAuth((s) => s.updateAvatar)
  const toast = useUi((s) => s.toast)
  const [avatar, setAvatar] = useState<Avatar | null>(profile?.avatar ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!profile || !avatar) return null

  async function save() {
    if (!avatar) return
    setBusy(true)
    const err = await updateAvatar(avatar)
    setBusy(false)
    if (err) return setError(err)
    toast(copy.myRoom.saved)
    onClose()
  }

  return (
    <Dialog title={copy.myRoom.beanTitle} onClose={onClose} labelledBy="bean-title">
      <div className="mt-4 flex justify-center">
        <Bean colors={avatar.colors} size={96} title={profile.display_name} />
      </div>
      <AvatarSwatches avatar={avatar} onChange={setAvatar} />
      <ErrorText code={error} />
      <div className="mt-6 flex gap-3">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          {copy.home.cancel}
        </button>
        <button type="button" className="btn btn-primary flex-1" disabled={busy} onClick={() => void save()}>
          {copy.myRoom.save}
        </button>
      </div>
    </Dialog>
  )
}
