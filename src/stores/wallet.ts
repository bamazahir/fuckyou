// Coins and things owned (SPEC §6.5). Read through RLS / RPCs; every change goes through an RPC.
import { create } from 'zustand'
import type { LayoutItem } from '../core/grid'
import { rpcErrorCode, supabase } from '../lib/supabase'

interface WalletState {
  balance: number | null
  earnedToday: number
  owned: Map<string, number>
  personalLayout: LayoutItem[] | null
  load: () => Promise<void>
  buy: (itemId: string, qty?: number) => Promise<string | null>
  donate: (roomId: string, amount: number) => Promise<string | null>
  savePersonalLayout: (roomId: string, layout: LayoutItem[]) => Promise<string | null>
  clear: () => void
}

export const useWallet = create<WalletState>((set, get) => ({
  balance: null,
  earnedToday: 0,
  owned: new Map(),
  personalLayout: null,

  load: async () => {
    const [wallet, inv, room] = await Promise.all([
      supabase.rpc('my_wallet'),
      supabase.from('inventory').select('item_id, qty'),
      supabase.from('rooms').select('layout').eq('is_personal', true).maybeSingle(),
    ])
    const w = wallet.data as { balance?: number; earned_today?: number } | null
    set({
      balance: w?.balance ?? 0,
      earnedToday: w?.earned_today ?? 0,
      owned: new Map(
        ((inv.data as { item_id: string; qty: number }[] | null) ?? []).map((r) => [r.item_id, r.qty]),
      ),
      personalLayout: ((room.data as { layout?: LayoutItem[] } | null)?.layout ?? null) as
        LayoutItem[] | null,
    })
  },

  buy: async (itemId, qty = 1) => {
    const { error } = await supabase.rpc('buy_item', { p_item_id: itemId, p_qty: qty })
    if (error) return rpcErrorCode(error)
    await get().load()
    return null
  },

  donate: async (roomId, amount) => {
    const { error } = await supabase.rpc('donate', { p_room_id: roomId, p_amount: amount })
    if (error) return rpcErrorCode(error)
    await get().load()
    return null
  },

  savePersonalLayout: async (roomId, layout) => {
    const { error } = await supabase.rpc('save_layout', { p_room_id: roomId, p_layout: layout })
    if (error) return rpcErrorCode(error)
    set({ personalLayout: layout })
    return null
  },

  clear: () => set({ balance: null, earnedToday: 0, owned: new Map(), personalLayout: null }),
}))
