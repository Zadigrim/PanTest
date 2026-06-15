import { resolveCoverImage, type CoverResolverInput } from '@/lib/cover/resolve'

// Front-cover panel ratio = 612:869 = ~0.7043:1 (portrait). The cover
// SPREAD is 1252×869 (back panel 612 + spine 28 + front panel 612);
// passport cards show only the FRONT PANEL — the rightmost 612 of the
// spread, full 869 height. paddingBottom = 100% * 869/612 = 141.99%.
const FRONT_PANEL_PADDING_BOTTOM = `${(869 / 612) * 100}%`

interface Props {
  title: string
  typeIcon: string
  // Cover-source fields. Pass these directly from the passport row.
  // The resolver in lib/cover/resolve.ts decides which to render.
  outsideData?: CoverResolverInput['cover_outside_data']
  coverImageUrl?: string | null
  coverThumbnail?: string | null
  fallbackBg?: string | null
  /** Render the round white type-icon badge in the bottom-right of the
   *  thumbnail. Defaults to true. Surfaces that show the icon next to
   *  the title (e.g. the My Passports list) pass false to keep the
   *  cover art unobstructed. */
  showTypeBadge?: boolean
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
  // SVG sized to match the front-panel aspect (612:869). Render box
  // 280×398 keeps the design proportions when scaled by the card.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="398" viewBox="0 0 280 398">
  <rect width="280" height="398" fill="#0D1B2A"/>
  <circle cx="140" cy="176" r="180" fill="none" stroke="#1D9E75" stroke-width="0.6" opacity="0.12"/>
  <circle cx="140" cy="176" r="140" fill="none" stroke="#1D9E75" stroke-width="0.6" opacity="0.12"/>
  <circle cx="140" cy="176" r="100" fill="none" stroke="#1D9E75" stroke-width="0.6" opacity="0.12"/>
  <circle cx="140" cy="176" r="60"  fill="none" stroke="#1D9E75" stroke-width="0.6" opacity="0.12"/>
  <text x="140" y="77" text-anchor="middle" font-family="Arial" font-size="11" font-weight="bold" letter-spacing="6" fill="#1D9E75">OKUJI</text>
  <text x="140" y="209" text-anchor="middle" font-family="Arial" font-size="20" font-weight="bold" letter-spacing="8" fill="white">PASSPORT</text>
  ${tl[0] ? `<text x="140" y="240" text-anchor="middle" font-family="Arial" font-size="10" fill="rgba(255,255,255,0.75)">${tl[0]}</text>` : ''}
  ${tl[1] ? `<text x="140" y="255" text-anchor="middle" font-family="Arial" font-size="10" fill="rgba(255,255,255,0.75)">${tl[1]}</text>` : ''}
  <line x1="40" y1="352" x2="240" y2="352" stroke="#1D9E75" stroke-width="1" opacity="0.3"/>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function PassportCoverThumbnail({
  title,
  typeIcon,
  outsideData,
  coverImageUrl,
  coverThumbnail,
  fallbackBg,
  showTypeBadge = true,
}: Props) {
  const resolved = resolveCoverImage({
    cover_outside_data: outsideData,
    cover_image_url: coverImageUrl ?? null,
    cover_thumbnail: coverThumbnail ?? null,
    cover_bg_color: fallbackBg ?? null,
  })

  const badge = showTypeBadge ? (
    <span
      className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full text-base"
      style={{ backgroundColor: 'rgba(255,255,255,0.9)' }}
      aria-hidden="true"
    >
      {typeIcon}
    </span>
  ) : null

  // Resolved cover image (any of cover_outside_data.image_url,
  // cover_image_url legacy field, or cover_thumbnail).
  if (resolved) {
    const objectPosition = resolved.crop === 'right-panel' ? 'right top' : 'center center'
    return (
      <div
        className="relative w-full overflow-hidden"
        style={{ paddingBottom: FRONT_PANEL_PADDING_BOTTOM, backgroundColor: `#${resolved.bgColor}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={resolved.url}
          alt={`${title} cover`}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition, opacity: resolved.opacity }}
        />
        {badge}
      </div>
    )
  }

  // No image anywhere — procedural SVG.
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
