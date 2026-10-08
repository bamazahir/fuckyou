import { copy } from '../../content/copy'

export function MyRoomPage() {
  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">{copy.myRoom.title}</h1>
      <div className="card card-raised p-6">
        <p className="max-w-prose">{copy.myRoom.body}</p>
      </div>
    </div>
  )
}
