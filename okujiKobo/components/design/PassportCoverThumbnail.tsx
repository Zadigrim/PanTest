import type { CoverSideData } from '@/lib/design/types'

// Front-cover panel ratio = 612:792 = ~0.7727:1 (portrait). The cover
// SPREAD is 1248×792 (back panel 612 + spine 24 + front panel 612);
// passport cards show only the FRONT PANEL — the rightmost 612 of the
// spread, full 792 height. paddingBottom = 100% * 792/612 = 129.41%.
const FRONT_PANEL_PADDING_BOTTOM = `${(792 / 612) * 100}%`

interface Props {
  title: string
  typeIcon: string
  outsideData?: CoverSideData | null
  /** Pre-composited thumbnail from canvas (base64 data-URI). Snapshot of
   *  the FULL spread (1248×792 aspect, downscaled to ~280×178 in
   *  useCoverThumbnail). Render-time crop shows only the right half. */
  coverThumbnail?: string | null
  /** Legacy fallback: hex without # */
  fallbackBg?: string | null
}

function defaultThumbnailSvg(title: string): string {
  const safe = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
  const words = safe.split(' ')
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    if ((current + ' ' + w).trim().length > 20 && current) {
      lines.push(current.trim())
      current = w
    } else {
      current = (current + ' ' + w).trim()
    }
  }
  if (current) lines.push(current.trim())
  const tl = lines.slice(0, 2)
  // SVG sized to match the front-panel aspect (612:792). Render box
  // 280×362 keeps the design proportions when scaled by the card.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="362" viewBox="0 0 280 362">
  <rect width="280" height="362" fill="#0D1B2A"/>
  <circle cx="140" cy="160" r="180" fill="none" stroke="#1D9E75" stroke-width="0.6" opacity="0.12"/>
  <circle cx="140" cy="160" r="140" fill="none" stroke="#1D9E75" stroke-width="0.6" opacity="0.12"/>
  <circle cx="140" cy="160" r="100" fill="none" stroke="#1D9E75" stroke-width="0.6" opacity="0.12"/>
  <circle cx="140" cy="160" r="60"  fill="none" stroke="#1D9E75" stroke-width="0.6" opacity="0.12"/>
  <text x="140" y="70" text-anchor="middle" font-family="Arial" font-size="11" font-weight="bold" letter-spacing="6" fill="#1D9E75">OKUJI</text>
  <text x="140" y="190" text-anchor="middle" font-family="Arial" font-size="20" font-weight="bold" letter-spacing="8" fill="white">PASSPORT</text>
  ${tl[0] ? `<text x="140" y="218" text-anchor="middle" font-family="Arial" font-size="10" fill="rgba(255,255,255,0.75)">${tl[0]}</text>` : ''}
  ${tl[1] ? `<text x="140" y="232" text-anchor="middle" font-family="Arial" font-size="10" fill="rgba(255,255,255,0.75)">${tl[1]}</text>` : ''}
  <line x1="40" y1="320" x2="240" y2="320" stroke="#1D9E75" stroke-width="1" opacity="0.3"/>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function PassportCoverThumbnail({ title, typeIcon, outsideData, coverThumbnail, fallbackBg }: Props) {
  const frontBg = outsideData?.front_bg ?? fallbackBg ?? '0D1B2A'
  const imageUrl = outsideData?.image_url ?? null
  const imageOpacity = outsideData?.image_opacity ?? 80
  const hasDesignedCover = outsideData && (outsideData.image_url || outsideData.front_bg !== '0D1B2A')

  const badge = (
    <span
      className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full text-base"
      style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}
      aria-hidden="true"
    >
      {typeIcon}
    </span>
  )

  // Render priority for designed covers:
  //
  //   1. If image_url is set, render the RAW spread image via
  //      object-cover + object-position:right. The raw image preserves
  //      the spread's natural 1248×792 aspect; the right-edge crop
  //      shows exactly the front-panel half. This is the reliable path.
  //
  //   2. If only cover_thumbnail is set (text-only covers, no uploaded
  //      image), fall back to the pre-composited thumbnail.
  //
  //   3. Otherwise, procedural SVG fallback.
  //
  // The previous version of this component preferred cover_thumbnail
  // unconditionally. That surfaced a separate bug in useCoverThumbnail's
  // compositeToDataUrl: when a creator uploads a 1248×792 spread,
  // compositeToDataUrl draws it at size (612, 792) on the panel-sized
  // canvas, which horizontally squishes the spread to half its native
  // width. The resulting thumbnail shows a compressed version of the
  // FULL spread, not the front panel — so my object-cover crop applied
  // to the thumbnail just rendered the compressed-full-spread cleanly,
  // not the front panel. Preferring image_url avoids the buggy
  // composition path entirely for image-bearing covers.

  if (imageUrl) {
    return (
      <div
        className="relative w-full overflow-hidden"
        style={{ paddingBottom: FRONT_PANEL_PADDING_BOTTOM, backgroundColor: `#${frontBg}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={`${title} cover`}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: 'right top', opacity: imageOpacity / 100 }}
        />
        {badge}
      </div>
    )
  }

  // Text-only cover (no uploaded image). The pre-composited thumbnail
  // captures the front_bg + text elements at the panel aspect.
  if (coverThumbnail) {
    return (
      <div
        className="relative w-full overflow-hidden"
        style={{ paddingBottom: FRONT_PANEL_PADDING_BOTTOM }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverThumbnail}
          alt={`${title} cover`}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: 'right top' }}
        />
        {badge}
      </div>
    )
  }

  // Designed cover with no image and no thumbnail — render the
  // front-panel background color as a solid block.
  if (hasDesignedCover) {
    return (
      <div
        className="relative w-full overflow-hidden"
        style={{ paddingBottom: FRONT_PANEL_PADDING_BOTTOM, backgroundColor: `#${frontBg}` }}
      >
        {badge}
      </div>
    )
  }

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ paddingBottom: FRONT_PANEL_PADDING_BOTTOM }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={defaultThumbnailSvg(title)}
        alt={`${title} cover`}
        className="absolute inset-0 h-full w-full object-cover"
      />
      {badge}
    </div>
  )
}
