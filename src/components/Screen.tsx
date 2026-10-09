import { errorMessage } from '../content/copy'
import type { ReactNode } from 'react'

/** Centered single-card layout for pre-app screens (sign-in, onboarding, waiting). */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      {children}
    </main>
  )
}

export function ErrorText({ code }: { code: string | null }) {
  if (!code) return null
  return (
    <p role="alert" className="mt-3 text-sm font-bold text-danger">
      {errorMessage(code)}
    </p>
  )
}
