import type { Avatar } from '../lib/db'
import { BeanPortrait } from './BeanPortrait'

/** Overlapping beans for "who's here" (room cards, invite preview). */
export function AvatarStack({
  people,
  size = 30,
}: {
  people: { display_name: string; avatar: Avatar }[]
  size?: number
}) {
  if (people.length === 0) return null
  return (
    <div className="flex items-end" aria-label={people.map((p) => p.display_name).join(', ')}>
      {people.slice(0, 4).map((p, i) => (
        <span key={`${p.display_name}-${i}`} className={i > 0 ? '-ml-3' : ''}>
          <BeanPortrait avatar={p.avatar} size={size} title={p.display_name} />
        </span>
      ))}
    </div>
  )
}
