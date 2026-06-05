/**
 * Asset-naming helpers — display-name fallback + filename prettifier.
 *
 * Used by the Assets section grid + drawer. Legacy rows have only
 * the raw filename stored in `name`; the UI shows a friendlier
 * title derived from it until a creator renames the asset (which
 * writes the new column `display_name`).
 */

/**
 * Make a raw upload filename human-friendly.
 *
 * Examples:
 *   "okuji-ground-01-guilloche-medallion.png" → "Okuji ground 01 guilloche medallion"
 *   "stamp_1704067200000.svg"                 → "Stamp" (trailing hash dropped)
 *   "IMG_0123.JPG"                            → "IMG 0123"
 *   "bg-1704067200000.png"                    → "Bg"
 *
 * Conservative — never invents text, only removes/replaces:
 *   1. strip extension (.png/.svg/etc.)
 *   2. strip a trailing pure-digit segment (timestamp / hash)
 *   3. replace dashes/underscores with spaces, collapse whitespace
 *   4. title-case the first letter
 *
 * If the result is empty (filename was just a hash) it falls back
 * to "Untitled" so the card never shows a blank title.
 */
export function prettifyFilename(raw: string | null | undefined): string {
  if (!raw) return 'Untitled'

  // 1. Take the basename, dropping any directory prefix.
  const base = raw.split('/').pop() ?? raw

  // 2. Strip extension.
  const noExt = base.replace(/\.[a-z0-9]{1,8}$/i, '')

  // 3. Drop a trailing pure-digit segment (e.g. "-1704067200000").
  //    Captures both hyphen and underscore-prefixed timestamps.
  const noStamp = noExt.replace(/[-_][0-9]{6,}$/, '')

  // 4. Normalise separators.
  const spaced = noStamp.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()

  if (!spaced) return 'Untitled'

  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

/**
 * The title to render on a card / drawer. Picks the renamed
 * display_name if set; otherwise prettifies the raw filename.
 */
export function assetDisplayTitle(asset: {
  display_name?: string | null
  name?: string | null
}): string {
  if (asset.display_name && asset.display_name.trim()) return asset.display_name.trim()
  return prettifyFilename(asset.name)
}
