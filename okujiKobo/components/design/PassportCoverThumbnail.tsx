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

  // For the two designed-cover render paths (pre-composited thumbnail
  // and raw image_url), the source might be either:
  //   - A panel-aspect thumbnail (~280×362), composited from cover_outside
  //     data with front_bg + image + elements.
  //   - A spread-aspect uploaded image (~1248×792 or similar wide ratio).
  //
  // Card slot aspect is the front-panel ratio (612:792 ≈ 0.773:1,
  // paddingBottom 129.41%). object-cover + object-position:right pins
  // the source's right edge to the card's right edge and crops overflow
  // from the left. For a panel-aspect source this fills cleanly (no
  // overflow). For a spread-aspect source the left ~half (back cover)
  // is cropped out and the right ~half (front cover) fills the card.
  // Net visible portion in both cases: the front cover panel.
  const spreadCropClass = 'absolute inset-0 w-full h-full object-cover'
  const spreadCropStyle: React.CSSProperties = { objectPosition: 'right top' }

  // Prefer pre-composited thumbnail (includes text elements, correct image transforms)
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
          className={spreadCropClass}
          style={spreadCropStyle}
        />
        {badge}
      </div>
    )
  }

  if (hasDesignedCover) {
    return (
      <div
        className="relative w-full overflow-hidden"
        style={{ paddingBottom: FRONT_PANEL_PADDING_BOTTOM, backgroundColor: `#${frontBg}` }}
      >
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className={spreadCropClass}
            style={{ ...spreadCropStyle, opacity: imageOpacity / 100 }}
          />
        )}
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
