/**
 * Stop Library — classifier → icon key mapping.
 *
 * The Stop Library renders a small icon tile on every card and
 * in the drawer header. The icon comes from the stamp-composer
 * shared catalog (lib/design/stamp-composer/icons/lucide-seed.ts);
 * this file just picks the right `iconKey` for the stop's
 * primary classifier.
 *
 * Algorithm:
 *   1. Walk the stop's classifier list in array order.
 *   2. First classifier with a mapping wins.
 *   3. Fall back to 'pin' (MapPin) if no match — neutral
 *      "this is a stop" glyph.
 *
 * Adding new classifiers: extend `CLASSIFIER_ICON_KEYS`. New
 * iconKeys (not currently in the lucide seed) need a parallel
 * entry in lucide-seed.ts so the renderer can find the
 * component. Today every value in the map below resolves to a
 * seed entry.
 */

import { LUCIDE_SEED } from '@/lib/design/stamp-composer/icons'
import type { LucideIcon } from 'lucide-react'

/** Each of the 30 classifier values maps to an iconKey present
 *  in the lucide seed catalog. Choices privilege a recognizable
 *  motif over a one-to-one literal — "industrial" → Compass
 *  (factory orientation) is a stretch; we use 'route' instead
 *  since most industrial classifier stops we've seen are
 *  walking tours of legacy infrastructure. */
export const CLASSIFIER_ICON_KEYS: Record<string, string> = {
  general:      'pin',
  educational:  'book-open',
  heritage:     'landmark',
  nature:       'leaf',
  food_drink:   'utensils',
  arts_culture: 'palette',
  family:       'heart',
  accessible:   'badge-check',
  challenge:    'mountain',
  hidden_gem:   'sparkles',
  learning:     'lightbulb',
  tour:         'route',
  outdoor:      'tree-pine',
  architecture: 'landmark',
  wildlife:     'paw',
  marine:       'fish',
  brewery:      'beer',
  wine:         'wine',
  coffee:       'coffee',
  music:        'music',
  theater:      'drama',
  photography:  'sparkles',
  cycling:      'bike',
  winter:       'snowflake',
  night:        'moon',
  spiritual:    'crown',
  industrial:   'route',
  garden:       'flower',
  schools:      'graduation',
  science:      'microscope',
}

const FALLBACK_KEY = 'pin'

/** Resolve a stop's classifier list → a single iconKey. */
export function iconKeyForClassifiers(classifiers: string[] | null | undefined): string {
  if (!classifiers) return FALLBACK_KEY
  for (const c of classifiers) {
    const key = CLASSIFIER_ICON_KEYS[c]
    if (key) return key
  }
  return FALLBACK_KEY
}

/** Resolve a stop's classifier list → a Lucide React component
 *  for rendering. The seed catalog is the source of truth for
 *  Component lookups; if a future custom okuji SVG drops in at
 *  public/stamp-icons/<key>.svg the picker prefers that, but
 *  the static lookup here keeps the Stop Library's cards
 *  zero-fetch. */
export function iconComponentForClassifiers(
  classifiers: string[] | null | undefined,
): LucideIcon {
  const key = iconKeyForClassifiers(classifiers)
  const entry = LUCIDE_SEED.find((e) => e.iconKey === key)
    ?? LUCIDE_SEED.find((e) => e.iconKey === FALLBACK_KEY)
  // `pin` is guaranteed in the seed (places category). The
  // non-null assertion is safe — the type system can't see it
  // statically.
  return entry!.Component
}
