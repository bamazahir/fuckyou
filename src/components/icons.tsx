import type { SVGProps } from 'react'

// One consistent set: 24px grid, 2px round strokes to match the 2px ink borders (studyroom-look §1).
function Icon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={24}
      height={24}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    />
  )
}

export function HomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9v11h14V9" />
      <path d="M10 20v-5h4v5" />
    </Icon>
  )
}

export function LampIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M8 3h8l3 7H5z" />
      <path d="M12 10v8" />
      <path d="M7 21h10" />
    </Icon>
  )
}

export function BeanIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="7.5" r="3.5" />
      <path d="M6.5 21v-3.5a5.5 5.5 0 0 1 11 0V21" />
    </Icon>
  )
}

/** A coin: filled with the accent role so it reads as money everywhere. */
export function CoinIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon width={20} height={20} {...props}>
      <circle cx="12" cy="12" r="9" fill="var(--accent)" stroke="var(--line)" />
      <path d="M12 7.5v9M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4" stroke="var(--line)" />
    </Icon>
  )
}

export function BagIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Icon {...props}>
      <path d="M5 8h14l-1 12H6z" />
      <path d="M9 8a3 3 0 0 1 6 0" />
    </Icon>
  )
}
