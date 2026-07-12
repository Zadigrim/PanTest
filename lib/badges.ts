import { Award } from 'lucide-react-native'
import type { ComponentType } from 'react'

// One client-side registry keyed by badge_key. Future badges are additive
// entries here; renaming a badge (e.g. "Founding Collector") is a one-string
// change. Display only — the earning rules live in SQL
// (award_demo_completion_badge, migration 108).
export interface BadgeMeta {
  name: string
  description: string
  // Monochrome single-stroke line icon (lucide seed). Rendered in the ink
  // token — no color, no gradient. Flagged as a drop-in swap for when the
  // custom Okuji icon set lands.
  Icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>
}

export const BADGE_REGISTRY: Record<string, BadgeMeta> = {
  founding_collector: {
    name: 'Founding Collector',
    description: 'Completed an okuji passport during the founding beta.',
    Icon: Award,
  },
}

export function getBadgeMeta(badgeKey: string): BadgeMeta | null {
  return BADGE_REGISTRY[badgeKey] ?? null
}
