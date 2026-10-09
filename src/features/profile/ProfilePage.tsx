import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BeanPreview } from '../../components/BeanPreview'
import { copy } from '../../content/copy'
import { useAuth } from '../../stores/auth'
import { AvatarEditor } from '../myroom/AvatarEditor'
import { AccountSection } from './AccountSection'
import { NotificationSettings } from './NotificationSettings'
import { ThemePicker } from './ThemePicker'

const t = copy.you

/** You: your bean (in 3D), how the app looks and pings you, and your account. */
export function ProfilePage() {
  const profile = useAuth((s) => s.profile)
  const [editing, setEditing] = useState(false)
  if (!profile) return null
  return (
    <div className="space-y-6">
      <section className="card card-raised flex flex-wrap items-center gap-5 p-5">
        <BeanPreview avatar={profile.avatar} size={160} title={profile.display_name} />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-3xl font-bold break-words">{profile.display_name}</h1>
          <p className="text-on-bg-muted">@{profile.handle}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" onClick={() => setEditing(true)}>
              {t.customize}
            </button>
            <Link to="/me/decorate" className="btn btn-secondary">
              {copy.decor.edit}
            </Link>
            <Link to="/stats" className="btn btn-secondary">
              {copy.stats.title}
            </Link>
          </div>
        </div>
      </section>
      <ThemePicker />
      <NotificationSettings />
      <AccountSection />
      {editing && <AvatarEditor onClose={() => setEditing(false)} />}
    </div>
  )
}
