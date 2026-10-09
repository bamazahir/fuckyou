import { AVATAR_SLOTS } from '../content/avatar'
import { copy } from '../content/copy'
import type { Avatar } from '../lib/db'

const t = copy.onboarding.bean

/** Curated color pickers for the four bean slots (studyroom-look §2). */
export function AvatarSwatches({ avatar, onChange }: { avatar: Avatar; onChange: (a: Avatar) => void }) {
  return (
    <>
      {AVATAR_SLOTS.map((slot) => (
        <fieldset key={slot.key} className="mt-4">
          <legend className="text-sm font-bold">{t[slot.key]}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {slot.swatches.map((hex) => (
              <label key={hex} className="swatch" style={{ backgroundColor: hex }}>
                <input
                  type="radio"
                  name={slot.key}
                  value={hex}
                  checked={avatar.colors[slot.key] === hex}
                  onChange={() => onChange({ ...avatar, colors: { ...avatar.colors, [slot.key]: hex } })}
                  className="sr-only"
                  aria-label={`${t[slot.key]} ${hex}`}
                />
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </>
  )
}
