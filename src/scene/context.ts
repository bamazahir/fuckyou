import { createContext, useContext } from 'react'
import type { SceneColors } from './palette'

export interface SceneEnv {
  c: SceneColors
  /** Outline thickness in world units (about 2 CSS px at the current zoom). */
  outline: number
  lampOn: boolean
  night: boolean
  shadows: boolean
  reducedMotion: boolean
}

export const SceneContext = createContext<SceneEnv | null>(null)

export function useScene(): SceneEnv {
  const env = useContext(SceneContext)
  if (!env) throw new Error('useScene outside <SceneContext>')
  return env
}
