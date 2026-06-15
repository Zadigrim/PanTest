/**
 * Per-asset-kind rendering rules — ratio, label, friendly kind.
 *
 * Every asset thumbnail / drawer preview renders at the asset's
 * TRUE pixel ratio — covers are 1252×869 (full wraparound spread,
 * never a cropped front), page backgrounds 612×869 portrait,
 * stamps 1:1, page images at native ratio (object-contain — never
 * crop to a fixed box).
 */

export type AssetTypeDb = 'background' | 'stamp' | 'cover' | 'image' | 'layout'

export const ASSET_TYPE_URL_SLUGS = ['backgrounds', 'stamps', 'covers', 'images', 'layouts'] as const
export type AssetTypeSlug = (typeof ASSET_TYPE_URL_SLUGS)[number]

export const SLUG_TO_DB: Record<AssetTypeSlug, AssetTypeDb> = {
  backgrounds: 'background',
  stamps:      'stamp',
  covers:      'cover',
  images:      'image',
  layouts:     'layout',
}

export const DB_TO_SLUG: Record<AssetTypeDb, AssetTypeSlug> = {
  background: 'backgrounds',
  stamp:      'stamps',
  cover:      'covers',
  image:      'images',
  layout:     'layouts',
}

export interface AssetKindRules {
  /** CSS aspect-ratio value, or null = native (object-contain). */
  aspectRatio: string | null
  /** Short label shown in the drawer meta line ("1252×869 · spread"). */
  ratioLabel: string
  /** Human label for the kind chip ("Cover · full spread", etc.). */
  kindLabel: string
  /** Tab heading + section heading on the Assets page. */
  sectionLabel: string
  /** What goes on the empty-state card. */
  emptyHeading: string
  emptyBody: string
}

export const KIND_RULES: Record<AssetTypeDb, AssetKindRules> = {
  cover: {
    aspectRatio: '1252 / 869',
    ratioLabel:  '1252×869 · spread',
    kindLabel:   'Cover · full spread',
    sectionLabel: 'Covers',
    emptyHeading: 'No custom covers yet.',
    emptyBody:    'Covers wrap the booklet — back · spine · front, all one image.',
  },
  background: {
    aspectRatio: '612 / 869',
    ratioLabel:  '612×869 · passport',
    kindLabel:   'Page background',
    sectionLabel: 'Backgrounds',
    emptyHeading: 'No custom backgrounds yet.',
    emptyBody:    'Backgrounds set the mood for your passport pages.',
  },
  stamp: {
    aspectRatio: '1 / 1',
    ratioLabel:  '1:1',
    kindLabel:   'Stamp emblem',
    sectionLabel: 'Stamps',
    emptyHeading: 'No custom stamps yet.',
    emptyBody:    'Stamps are the visual moments collectors earn.',
  },
  image: {
    aspectRatio: null,   // native; object-contain — never crop
    ratioLabel:  'native',
    kindLabel:   'Page image',
    sectionLabel: 'Images',
    emptyHeading: 'No page images yet.',
    emptyBody:    'Images placed on passport pages via "Add image" in the designer show up here.',
  },
  layout: {
    aspectRatio: null,   // native; variants differ (3–6 ticket rows etc.)
    ratioLabel:  'native',
    kindLabel:   'Layout · table',
    sectionLabel: 'Layouts',
    emptyHeading: 'No layouts yet.',
    emptyBody:    'Thin-lined tables and grids for organizing stamps and structuring pages. Place them via "Add layout" in the designer.',
  },
}

export function isAssetSlug(value: string): value is AssetTypeSlug {
  return (ASSET_TYPE_URL_SLUGS as readonly string[]).includes(value)
}

/** Format a byte count for the drawer meta line. */
export function formatBytes(b: number | null | undefined): string | null {
  if (b == null || !Number.isFinite(b) || b <= 0) return null
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(b < 10 * 1024 ? 1 : 0)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

/** Map a `file_format` MIME to its short tag — "PNG", "SVG", "JPG". */
export function formatTag(mime: string | null | undefined): string | null {
  if (!mime) return null
  const m = mime.toLowerCase()
  if (m.includes('svg')) return 'SVG'
  if (m.includes('png')) return 'PNG'
  if (m.includes('jpeg') || m.includes('jpg')) return 'JPG'
  if (m.includes('webp')) return 'WEBP'
  if (m.includes('gif')) return 'GIF'
  return m.replace('image/', '').toUpperCase()
}
