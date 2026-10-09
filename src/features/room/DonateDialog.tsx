import { useState, type FormEvent } from 'react'
import { Dialog } from '../../components/Dialog'
import { CoinIcon } from '../../components/icons'
import { ErrorText } from '../../components/Screen'
import { copy } from '../../content/copy'
import { shownBalance } from '../../core/coins'
import { useUi } from '../../stores/ui'
import { useWallet } from '../../stores/wallet'

const t = copy.coins

export function DonateDialog({
  roomId,
  onClose,
  onDone,
}: {
  roomId: string
  onClose: () => void
  onDone: () => void
}) {
  const { balance, donate } = useWallet()
  const toast = useUi((s) => s.toast)
  const [amount, setAmount] = useState('50')
  const [error, setError] = useState<string | null>(null)
  const have = shownBalance(balance ?? 0).coins
  const n = Math.floor(Number(amount))

  async function give(e: FormEvent) {
    e.preventDefault()
    const err = await donate(roomId, n)
    if (err) return setError(err)
    toast(t.given(n))
    onDone()
  }

  return (
    <Dialog title={t.donateTitle} onClose={onClose} labelledBy="donate-title">
      <p className="mt-2 text-sm text-muted">{t.donateHint}</p>
      <p className="mt-3 inline-flex items-center gap-2 font-bold">
        <CoinIcon /> {t.balance(have)}
      </p>
      <form onSubmit={give} className="mt-3">
        <label htmlFor="donate-amount" className="block text-sm font-bold">
          {t.amount}
        </label>
        <input
          id="donate-amount"
          type="number"
          inputMode="numeric"
          min={1}
          max={Math.max(1, have)}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="field mt-1"
        />
        <ErrorText code={error} />
        <div className="mt-5 flex gap-3">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {copy.home.cancel}
          </button>
          <button type="submit" className="btn btn-primary flex-1" disabled={!(n >= 1 && n <= have)}>
            {t.give}
          </button>
        </div>
      </form>
    </Dialog>
  )
}
