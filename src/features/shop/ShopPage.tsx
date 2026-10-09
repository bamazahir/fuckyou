import { goBack } from '../../components/goBack'
import { useEffect, useState } from 'react'
import { rovingKeys } from '../../components/roving'
import { Loading, LoadFailed } from '../../components/LoadFailed'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { BeanPortrait } from '../../components/BeanPortrait'
import { CoinIcon } from '../../components/icons'
import { ErrorText } from '../../components/Screen'
import { toggleAccessory } from '../../content/avatar'
import { copy } from '../../content/copy'
import { CATALOG, SHOP_ACCESSORIES, type CatalogItem } from '../../content/layouts'
import { shownBalance } from '../../core/coins'
import type { Accessory } from '../../lib/db'
import { rpcErrorCode, supabase } from '../../lib/supabase'
import { useAuth } from '../../stores/auth'
import { useRooms } from '../../stores/rooms'
import { useUi } from '../../stores/ui'
import { useWallet } from '../../stores/wallet'
import { ItemThumb } from './ItemThumb'

const t = copy.shop
type Tab = 'furniture' | 'decor' | 'wall' | 'accessory'

/** Your shop (/shop), or a shared room's shop paid from its bank (/room/:roomId/shop, owners and mods). */
export function ShopPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const profile = useAuth((s) => s.profile)
  const { balance, owned, load, buy, error: walletError } = useWallet()
  const rooms = useRooms((s) => s.rooms)
  const room = roomId ? rooms?.find((r) => r.id === roomId) : undefined
  const toast = useUi((s) => s.toast)
  const [tab, setTab] = useState<Tab>('furniture')
  const [error, setError] = useState<string | null>(null)
  const [bank, setBank] = useState<number | null>(null)
  const [roomOwned, setRoomOwned] = useState<Map<string, number>>(new Map())
  const [reload, setReload] = useState(0)
  const [roomFailed, setRoomFailed] = useState<string | null>(null)
  const [buying, setBuying] = useState<string | null>(null)

  useEffect(() => {
    if (!roomId) return void load()
    let cancelled = false
    void Promise.all([
      supabase.rpc('room_info', { p_room_id: roomId }),
      supabase.from('room_inventory').select('item_id, qty').eq('room_id', roomId),
    ]).then(([info, inv]) => {
      if (cancelled) return
      setRoomFailed(rpcErrorCode(info.error ?? inv.error))
      if (info.error || inv.error) return
      setBank((info.data as { bank_coins?: number } | null)?.bank_coins ?? 0)
      setRoomOwned(
        new Map(
          ((inv.data as { item_id: string; qty: number }[] | null) ?? []).map((r) => [r.item_id, r.qty]),
        ),
      )
    })
    return () => {
      cancelled = true
    }
  }, [roomId, load, reload])

  if (!profile) return null
  // Never show "0 coins" for "couldn't load": the shop waits for the real numbers.
  const unknownFunds = roomId ? bank === null : balance === null
  if (unknownFunds)
    return (roomId ? roomFailed : walletError) ? (
      <LoadFailed
        code={roomId ? roomFailed : walletError}
        onRetry={() => (roomId ? setReload((k) => k + 1) : void load())}
      />
    ) : (
      <Loading />
    )
  const funds = roomId ? Math.max(0, bank ?? 0) : shownBalance(balance ?? 0).coins
  const items = [...CATALOG.values()].filter((i) => i.category === tab)

  async function purchase(item: { id: string; name: string }) {
    if (buying) return
    setError(null)
    setBuying(item.id)
    try {
      await doPurchase(item)
    } finally {
      setBuying(null)
    }
  }

  async function doPurchase(item: { id: string; name: string }) {
    if (roomId) {
      const { error: err } = await supabase.rpc('room_buy_item', {
        p_room_id: roomId,
        p_item_id: item.id,
        p_qty: 1,
      })
      if (err) return setError(rpcErrorCode(err))
      toast(t.roomBought(item.name))
      setReload((k) => k + 1)
    } else {
      const err = await buy(item.id)
      if (err) return setError(err)
      toast(t.bought(item.name))
    }
  }

  const card = (item: CatalogItem) => {
    const have = roomId ? (roomOwned.get(item.id) ?? 0) : (owned.get(item.id) ?? 0)
    return (
      <li key={item.id} className="card flex flex-col items-center p-3 text-center">
        <ItemThumb itemId={item.id} name={item.name} />
        <p className="mt-1 font-bold break-words">{item.name}</p>
        <p className="text-sm text-muted">{have > 0 ? (roomId ? t.roomOwned(have) : t.owned(have)) : ' '}</p>
        <button
          type="button"
          className="btn btn-primary mt-2 w-full"
          disabled={buying !== null || funds < item.price}
          onClick={() => void purchase(item)}
          aria-label={`${t.buy} ${item.name}, ${item.price}`}
        >
          <CoinIcon /> {item.price}
        </button>
      </li>
    )
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">{room ? t.roomTitle(room.name) : t.title}</h1>
          <p className="text-on-bg-muted">{roomId ? t.roomHint : t.hint}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="pill text-base" data-testid="funds">
            <CoinIcon /> {roomId ? copy.coins.bank(funds) : copy.coins.balance(funds)}
          </span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => goBack(navigate, roomId ? `/room/${roomId}` : '/me')}
          >
            {t.back}
          </button>
        </div>
      </header>

      <div role="tablist" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(['furniture', 'decor', 'wall', ...(roomId ? [] : ['accessory'])] as Tab[]).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            tabIndex={tab === k ? 0 : -1}
            onKeyDown={rovingKeys}
            className={`chip ${tab === k ? 'chip-on' : ''}`}
            onClick={() => setTab(k)}
          >
            {t.tabs[k]}
          </button>
        ))}
      </div>
      <ErrorText code={error} />
      <div role="tabpanel" aria-label={t.tabs[tab]}>
        {tab === 'accessory' ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SHOP_ACCESSORIES.map((a) => {
              const have = (owned.get(a.id) ?? 0) > 0
              const preview = toggleAccessory({ ...profile.avatar, accessories: [] }, a.id as Accessory)
              return (
                <li key={a.id} className="card flex flex-col items-center p-3 text-center">
                  <BeanPortrait avatar={preview} size={80} title={a.name} />
                  <p className="mt-1 font-bold">
                    {copy.onboarding.bean.accessories[a.id as Accessory] ?? a.name}
                  </p>
                  {have ? (
                    <p className="mt-2 text-sm text-muted">
                      {t.ownedAccessory} · {t.wear}
                    </p>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary mt-2 w-full"
                      disabled={buying !== null || funds < a.price}
                      onClick={() => void purchase(a)}
                      aria-label={`${t.buy} ${a.name}, ${a.price}`}
                    >
                      <CoinIcon /> {a.price}
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{items.map(card)}</ul>
        )}
      </div>
      {!roomId && (
        <p className="text-sm text-on-bg-muted">
          <Link to="/me" className="underline">
            {copy.myRoom.title}
          </Link>
        </p>
      )}
    </div>
  )
}
