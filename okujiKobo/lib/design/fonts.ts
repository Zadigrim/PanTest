/**
 * Designer font catalog — first canonical home for the small
 * set of fonts the stamp composer (and any future text-on-
 * passport surface) draws from.
 *
 * Why these five:
 *   - Inter        — already used throughout okujiKobo; clean
 *                    modern sans, good at small stamp sizes.
 *   - Georgia      — system serif on every consumer; classic
 *                    rim-text feel without a font file load.
 *   - Times New Roman — traditional civic / library tone.
 *   - Courier New  — monochrome stamps love a typewriter face;
 *                    pairs naturally with date-rule presets.
 *   - Impact       — heavy display for badges + short labels.
 *
 * None of these require an out-of-band font load; the browser
 * matches by family name. Saved SVG files name the family in
 * font-family attributes — non-web consumers fall back to a
 * system match (Push 6 lands embedded font data so mobile/PDF
 * render the chosen face exactly).
 */

export interface StampFont {
  /** Stable key — what gets stored in element metadata. */
  key: string
  /** Human label for the font dropdown. */
  label: string
  /** CSS font-family stack. First entry is the named face; the
   *  rest are generic fallbacks for safety. */
  family: string
}

export const STAMP_FONTS: StampFont[] = [
  { key: 'inter',         label: 'Inter',           family: 'Inter, system-ui, sans-serif' },
  { key: 'georgia',       label: 'Georgia',         family: 'Georgia, serif' },
  { key: 'times',         label: 'Times',           family: '"Times New Roman", Times, serif' },
  { key: 'courier',       label: 'Courier',         family: '"Courier New", Courier, monospace' },
  { key: 'impact',        label: 'Impact',          family: 'Impact, Charcoal, sans-serif' },
]

export const DEFAULT_STAMP_FONT_KEY: string = 'inter'

export function fontByKey(key: string | undefined | null): StampFont {
  if (!key) return STAMP_FONTS[0]
  return STAMP_FONTS.find((f) => f.key === key) ?? STAMP_FONTS[0]
}
