/**
 * Stamp Composer — starter compositions.
 *
 * Push 1 ships ONE preset (the simplest one — a rounded-rect
 * date stamp with rule lines) so the feature is verifiable
 * end-to-end and we can prove the round-trip works. Push 5
 * adds the remaining two-three (double-circle rim, simple
 * badge) so non-designers start from a curated good thing.
 *
 * Presets are fully-editable element sets — choosing one
 * populates the composer document, then every element behaves
 * like one the user added by hand.
 */

import { STAMP_SURFACE_SIZE, newElementId, type ComposerMetadata } from './types'

export interface PresetEntry {
  /** Stable id used by the preset picker. */
  key: string
  /** Display name. */
  label: string
  /** Short description below the label. */
  hint: string
  /** Builder — returns a fresh document each call so picking
   *  twice doesn't share element ids. */
  build: () => ComposerMetadata
}

const S = STAMP_SURFACE_SIZE  // 256

export const PRESETS: PresetEntry[] = [
  {
    key: 'date-rule',
    label: 'Date stamp',
    hint: 'Rounded rectangle with two rule lines — fill the lines in the designer.',
    build: () => ({
      version: 1,
      surface: { w: S, h: S },
      elements: [
        {
          id: newElementId(),
          name: 'outer',
          type: 'rect',
          x: 20, y: 60, w: S - 40, h: S - 120,
          rx: 18,
          strokeWidth: 4,
          filled: false,
        },
        {
          id: newElementId(),
          name: 'inner',
          type: 'rect',
          x: 30, y: 70, w: S - 60, h: S - 140,
          rx: 12,
          strokeWidth: 1.5,
          filled: false,
        },
        {
          id: newElementId(),
          name: 'top rule',
          type: 'line',
          x1: 50, y1: S / 2 - 12, x2: S - 50, y2: S / 2 - 12,
          strokeWidth: 2,
        },
        {
          id: newElementId(),
          name: 'bottom rule',
          type: 'line',
          x1: 50, y1: S / 2 + 18, x2: S - 50, y2: S / 2 + 18,
          strokeWidth: 2,
        },
      ],
    }),
  },
]

export const BLANK_PRESET: PresetEntry = {
  key: 'blank',
  label: 'Start blank',
  hint: 'Empty canvas — add elements yourself.',
  build: () => ({
    version: 1,
    surface: { w: S, h: S },
    elements: [],
  }),
}
