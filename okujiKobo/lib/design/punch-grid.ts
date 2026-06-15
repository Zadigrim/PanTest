'use client'

// Optional snap-to-grid for the moichido card designer. Lets a merchant lay
// out evenly-spaced punches by snapping each punch box to a grid.
//
// Scoped to moichido via React context: CardWorkspace provides it; the shared
// Canvas/PunchBox consume it. The okuji passport designer never wraps its
// workspace in this provider, so it gets the default (disabled) — no behavior
// change there. The grid is an editing aid only; nothing about it is persisted
// on the card itself (just the designer's local preference).
import { createContext } from 'react'

export interface PunchGrid {
  enabled: boolean
  /** Grid cell size in artboard units (the 612×792 space). */
  size: number
}

export const PUNCH_GRID_DEFAULT: PunchGrid = { enabled: false, size: 24 }

export const PUNCH_GRID_SIZES = [16, 24, 32, 48] as const

export const PunchGridContext = createContext<PunchGrid>(PUNCH_GRID_DEFAULT)

/** Round a value to the nearest grid multiple. No-op for a non-positive size. */
export function snapToGrid(value: number, size: number): number {
  if (!Number.isFinite(size) || size <= 0) return value
  return Math.round(value / size) * size
}
