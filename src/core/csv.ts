// CSV for the admin metrics export (SPEC §12). Pure.

type Cell = string | number | null | undefined

/** RFC 4180-style CSV; cells starting with = + - @ are prefixed so spreadsheets don't run them. */
export function toCsv(header: readonly string[], rows: readonly (readonly Cell[])[]): string {
  const cell = (v: Cell) => {
    let s = v === null || v === undefined ? '' : String(v)
    if (typeof v === 'string' && /^[=+\-@]/.test(s)) s = `'${s}`
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}

/** A retention share as a whole percent, or '' when the cohort isn't old enough yet. */
export function percent(part: number | null, whole: number): string {
  if (part === null || whole === 0) return ''
  return `${Math.round((100 * part) / whole)}%`
}
