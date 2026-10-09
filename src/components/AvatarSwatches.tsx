import { useState } from 'react'
import {
  ACCESSORIES,
  AVATAR_SLOTS,
  BOTTOM_STYLES,
  HAIR_STYLES,
  lookOf,
  TOP_STYLES,
  toggleAccessory,
} from '../content/avatar'
import { copy } from '../content/copy'
import type { Avatar } from '../lib/db'

const t = copy.onboarding.bean

function Choice<T extends string>({
  legend,
  name,
  options,
  value,
  label,
  onPick,
  columns,
}: {
  legend: string
  name: string
  options: readonly T[]
  value: T
  label: (v: T) => string
  onPick: (v: T) => void
  columns: string
}) {
  return (
    <fieldset className="mt-4">
      <legend className="text-sm font-bold">{legend}</legend>
      <div className={`mt-2 grid gap-2 ${columns}`}>
        {options.map((o) => (
          <label key={o} className={`chip px-2 text-sm ${value === o ? 'chip-on' : ''}`}>
            <input
              type="radio"
              name={name}
              value={o}
              checked={value === o}
              onChange={() => onPick(o)}
              className="sr-only"
            />
            {label(o)}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/** Style (hair, outfit, accessories) and curated color pickers (studyroom-look §2). */
export function AvatarSwatches({ avatar, onChange }: { avatar: Avatar; onChange: (a: Avatar) => void }) {
  const [tab, setTab] = useState<'style' | 'colors'>('style')
  const look = lookOf(avatar)
  return (
    <>
      <div role="tablist" className="mt-4 grid grid-cols-2 gap-2">
        {(['style', 'colors'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            className={`chip ${tab === k ? 'chip-on' : ''}`}
            onClick={() => setTab(k)}
          >
            {t.tabs[k]}
          </button>
        ))}
      </div>

      {tab === 'style' ? (
        <div role="tabpanel">
          <Choice
            legend={t.hairStyle}
            name="hair-style"
            options={HAIR_STYLES}
            value={look.hair}
            label={(v) => t.styles[v]}
            onPick={(hair) => onChange({ ...avatar, hair })}
            columns="grid-cols-4"
          />
          <Choice
            legend={t.topStyle}
            name="top-style"
            options={TOP_STYLES}
            value={look.top}
            label={(v) => t.tops[v]}
            onPick={(top) => onChange({ ...avatar, outfit: { ...avatar.outfit, top } })}
            columns="grid-cols-4"
          />
          <Choice
            legend={t.bottomStyle}
            name="bottom-style"
            options={BOTTOM_STYLES}
            value={look.bottom}
            label={(v) => t.bottoms[v]}
            onPick={(bottom) => onChange({ ...avatar, outfit: { ...avatar.outfit, bottom } })}
            columns="grid-cols-3"
          />
          <fieldset className="mt-4">
            <legend className="text-sm font-bold">{t.accessoriesLabel}</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {ACCESSORIES.map(({ id }) => (
                <label key={id} className={`chip px-2 text-sm ${look.accessories.has(id) ? 'chip-on' : ''}`}>
                  <input
                    type="checkbox"
                    checked={look.accessories.has(id)}
                    onChange={() => onChange(toggleAccessory(avatar, id))}
                    className="sr-only"
                  />
                  {t.accessories[id]}
                </label>
              ))}
            </div>
          </fieldset>
        </div>
      ) : (
        <div role="tabpanel">
          {AVATAR_SLOTS.map((slot) => {
            const current = slot.key === 'accent' ? look.accent : avatar.colors[slot.key]
            return (
              <fieldset key={slot.key} className="mt-4">
                <legend className="text-sm font-bold">{t[slot.key]}</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {slot.swatches.map((hex) => (
                    <label key={hex} className="swatch" style={{ backgroundColor: hex }}>
                      <input
                        type="radio"
                        name={slot.key}
                        value={hex}
                        checked={current === hex}
                        onChange={() =>
                          onChange({ ...avatar, colors: { ...avatar.colors, [slot.key]: hex } })
                        }
                        className="sr-only"
                        aria-label={`${t[slot.key]} ${hex}`}
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            )
          })}
        </div>
      )}
    </>
  )
}
