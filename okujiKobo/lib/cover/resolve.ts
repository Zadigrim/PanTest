// Single source of truth for resolving a passport's cover image across
// every storage location it can live in. Consumers (cards, marketplace
// hero, designer preview) call this to find out WHAT to render and how
// to crop it, instead of each consumer hand-rolling the field-priority
// dance.
//
// Storage locations (in resolution order):
//
//   1. passport.cover_outside_data.image_url
//      Image uploaded through the cover designer. The newest path.
//      Usually a 1252×869 spread; sometimes a panel-only 612×869 image.
//
//   2. passport.cover_image_url
//      Legacy top-level field on the passports row. Set by older upload
//      flows that pre-dated the designer's cover-side-data model. Some
//      existing passports have their cover ONLY here.
//
//   3. passport.cover_thumbnail
//      Pre-composited base64 PNG written by useCoverThumbnail when a
//      cover is saved in the designer. Useful as a fallback for
//      text-only designs (no image_url), but is HORIZONTALLY SQUISHED
//      for spread-aspect uploads due to a bug in compositeToDataUrl
//      (the routine draws the source image at 612×869 on a panel-sized
//      canvas, which compresses a 1252-wide spread by ~51%). Treat this
//      source as opaque — no further cropping can recover the front
//      panel cleanly. Used only when no other source is available.
//
//   4. None — caller falls back to the procedural SVG (handled outside
//      this resolver).
//
// 'crop' indicates how the consumer should display the image:
//   - 'right-panel': image is (or might be) a 1252×869 spread. Render
//     with object-cover + object-position:right to show the rightmost
//     612×869 (front panel). For panel-aspect sources this is a no-op.
//   - 'fit': image is already pre-composited for the card; render with
//     object-cover + object-position:center (no spread crop to apply).

export interface ResolvedCoverImage {
  url: string
  /** Background color behind the image (front_bg if known; else fallback). */
  bgColor: string
  /** Image opacity 0..1 (only meaningful when source comes from
   *  cover_outside_data with image_opacity set). */
  opacity: number
  /** How to crop the image inside the card frame. */
  crop: 'right-panel' | 'fit'
}

export interface CoverResolverInput {
  cover_outside_data?: { image_url?: string | null; front_bg?: string | null; image_opacity?: number | null } | null
  cover_image_url?: string | null
  cover_thumbnail?: string | null
  cover_bg_color?: string | null
}

const DEFAULT_BG = '0D1B2A'

export function resolveCoverImage(passport: CoverResolverInput): ResolvedCoverImage | null {
  const frontBg = passport.cover_outside_data?.front_bg
    ?? passport.cover_bg_color
    ?? DEFAULT_BG

  // 1. cover_outside_data.image_url (newest path)
  const outsideImage = passport.cover_outside_data?.image_url ?? null
  if (outsideImage) {
    return {
      url: outsideImage,
      bgColor: frontBg,
      opacity: (passport.cover_outside_data?.image_opacity ?? 100) / 100,
      crop: 'right-panel',
    }
  }

  // 2. cover_image_url (legacy top-level field)
  if (passport.cover_image_url) {
    return {
      url: passport.cover_image_url,
      bgColor: frontBg,
      opacity: 1,
      crop: 'right-panel',
    }
  }

  // 3. cover_thumbnail (pre-composited; treat as opaque, no spread crop)
  if (passport.cover_thumbnail) {
    return {
      url: passport.cover_thumbnail,
      bgColor: frontBg,
      opacity: 1,
      crop: 'fit',
    }
  }

  return null
}
