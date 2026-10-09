import type { KeyboardEvent } from 'react'

/**
 * Arrow keys, Home and End inside a tablist or radiogroup (WAI-ARIA pattern): move to the next enabled
 * item and select it. Pair with `tabIndex={selected ? 0 : -1}` so the group is one Tab stop.
 */
export function rovingKeys(e: KeyboardEvent<HTMLElement>): void {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
  if (step === undefined && e.key !== 'Home' && e.key !== 'End') return
  const group = e.currentTarget.closest('[role="tablist"], [role="radiogroup"]')
  if (!group) return
  const items = [...group.querySelectorAll<HTMLButtonElement>('[role="tab"], [role="radio"]')].filter(
    (el) => !el.disabled,
  )
  if (items.length === 0) return
  const i = items.indexOf(e.currentTarget as HTMLButtonElement)
  const next =
    e.key === 'Home'
      ? 0
      : e.key === 'End'
        ? items.length - 1
        : (i + (step ?? 0) + items.length) % items.length
  e.preventDefault()
  items[next]?.focus()
  items[next]?.click()
}
