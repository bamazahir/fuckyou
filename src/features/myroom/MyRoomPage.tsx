import { useState } from 'react'
import { Link } from 'react-router-dom'
import { copy } from '../../content/copy'
import { BagIcon, CoinIcon } from '../../components/icons'
import { shownBalance } from '../../core/coins'
import { useAuth } from '../../stores/auth'
import { useWallet } from '../../stores/wallet'
import { AvatarEditor } from './AvatarEditor'
import { PersonalRoomView } from './PersonalRoomView'

const t = copy.myRoom

/** Your room: your bean, your coins, and the way into decorating and the shop (SPEC §5.4). */
export function MyRoomPage() {
  const personalRoomId = useAuth((s) => s.personalRoomId)
  const [editing, setEditing] = useState(false)
  const balance = useWallet((s) => s.balance)
  const wallet = balance === null ? null : shownBalance(balance)
  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">{t.title}</h1>
          {wallet && (
            <p className="mt-1 inline-flex items-center gap-2 text-on-bg-muted" data-testid="balance">
              <CoinIcon /> {copy.coins.balance(wallet.coins)}
              {wallet.inDebt && <span className="text-sm">· {copy.coins.debt}</span>}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/me/decorate" className="btn btn-secondary">
            {copy.decor.edit}
          </Link>
          <Link to="/shop" className="btn btn-secondary">
            <BagIcon /> {copy.shop.title}
          </Link>
          <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
            {t.editBean}
          </button>
          {personalRoomId && (
            <Link to={`/room/${personalRoomId}`} className="btn btn-primary">
              {t.studyHere}
            </Link>
          )}
        </div>
      </header>
      <div className="card card-raised overflow-hidden">
        <PersonalRoomView className="h-[min(60svh,520px)] min-h-72 lg:h-[600px]" />
        <p className="border-t-2 border-line bg-surface-2 px-4 py-2 text-muted">{t.body}</p>
      </div>
      {editing && <AvatarEditor onClose={() => setEditing(false)} />}
    </div>
  )
}
