import { AVATAR_SLOTS, HAIR_STYLES, hairOf } from '../content/avatar'
import { copy } from '../content/copy'
import type { Avatar } from '../lib/db'

const t = copy.onboarding.bean

/** Hairstyle chips and curated color pickers for the four slots (studyroom-look §2). */
export function AvatarSwatches({ avatar, onChange }: { avatar: Avatar; onChange: (a: Avatar) => void }) {
  const style = hairOf(avatar)
  return (
    <>
      <fieldset className="mt-4">
        <legend className="text-sm font-bold">{t.hairStyle}</legend>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {HAIR_STYLES.map((s) => (
            <label key={s} className={`chip ${style === s ? 'chip-on' : ''}`}>
              <input
                type="radio"
                name="hair-style"
                value={s}
                checked={style === s}
                onChange={() => onChange({ ...avatar, hair: s })}
                className="sr-only"
              />
              {t.styles[s]}
            </label>
          ))}
        </div>
      </fieldset>
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
