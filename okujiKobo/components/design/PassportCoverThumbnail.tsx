import type { CoverSideData } from '@/lib/design/types'

interface Props {
  title: string
  typeIcon: string
  outsideData?: CoverSideData | null
  /** Pre-composited thumbnail from canvas (base64 data-URI) */
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
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="280" height="420" viewBox="0 0 280 420">
  <rect width="280" height="420" fill="#0D1B2A"/>
  <circle cx="140" cy="190" r="180" fill="none" stroke="#1D9E75" stroke-width="0.6" opacity="0.12"/>
  <circle cx="140" cy="190" r="140" fill="none" stroke="#1D9E75" stroke-width="0.6" opacity="0.12"/>
  <circle cx="140" cy="190" r="100" fill="none" stroke="#1D9E75" stroke-width="0.6" opacity="0.12"/>
  <circle cx="140" cy="190" r="60"  fill="none" stroke="#1D9E75" stroke-width="0.6" opacity="0.12"/>
  <text x="140" y="80" text-anchor="middle" font-family="Arial" font-size="11" font-weight="bold" letter-spacing="6" fill="#1D9E75">OKUJI</text>
  <text x="140" y="220" text-anchor="middle" font-family="Arial" font-size="20" font-weight="bold" letter-spacing="8" fill="white">PASSPORT</text>
  ${tl[0] ? `<text x="140" y="248" text-anchor="middle" font-family="Arial" font-size="10" fill="rgba(255,255,255,0.75)">${tl[0]}</text>` : ''}
  ${tl[1] ? `<text x="140" y="262" text-anchor="middle" font-family="Arial" font-size="10" fill="rgba(255,255,255,0.75)">${tl[1]}</text>` : ''}
  <line x1="40" y1="370" x2="240" y2="370" stroke="#1D9E75" stroke-width="1" opacity="0.3"/>
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

  // Prefer pre-composited thumbnail (includes text elements, correct image transforms)
  if (coverThumbnail) {
    return (
      <div
        className="relative w-full overflow-hidden"
        style={{ paddingBottom: '150%' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={coverThumbnail}
          alt={`${title} cover`}
          className="absolute inset-0 h-full w-full object-cover"
        />
        {badge}
      </div>
    )
  }

  if (hasDesignedCover) {
    return (
      <div
        className="relative w-full overflow-hidden"
        style={{ paddingBottom: '150%', backgroundColor: `#${frontBg}` }}
      >
        {imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            style={{ opacity: imageOpacity / 100 }}
          />
        )}
        {badge}
      </div>
    )
  }

  return (
    <div
      className="relative w-full overflow-hidden"
      style={{ paddingBottom: '150%' }}
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
