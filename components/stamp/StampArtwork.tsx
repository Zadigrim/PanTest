// Stamp renderer with two artwork modes + two appearance models.
//
// Artwork modes (REQ 2 — fidelity to the designer's choice):
//
//   Default ('emoji' or null stamp_type): SVG shape (circle/rect/hexagon/
//   badge) drawn in stop.stamp_color with stop.stamp_icon centered inside.
//   The historical renderer.
//
//   Custom asset (stamp_type='custom_asset' AND stamp_asset.url present):
//   the designer's uploaded stamp image is rendered as an <Image>, sized to
//   the stamp's render size. The shape + emoji path is skipped entirely —
//   the uploaded artwork IS the stamp.
//
// Appearance models (BLD-34, migration 040) — apply to BOTH artwork modes:
//
//   Legacy (pre-gesture): driven by the stop's discrete stamp_smudge enum
//   (none / light / medium / heavy). Rendered as a single stamp with an
//   isotropic FeDisplacementMap filter scaled by the enum.
//
//   Gesture-derived (migration 040): scalar saturation + directional smudge
//   (smudge_dx, smudge_dy, smudge_intensity). Renders the stamp with
//   opacity = saturation, plus directional ghost copies offset along
//   the smudge vector with declining opacity — a motion-blur style trail
//   that scales with smudge_intensity.
//
// Passing any gesture-derived prop (saturation, smudgeDx, smudgeDy, or
// smudgeIntensity) switches the renderer into gesture mode for that
// instance. When all are absent, the legacy discrete model is used.
//
// Patent posture preserved: the renderer doesn't claim contact-area
// scaling. It just renders what the gesture component or the legacy stop
// enum tells it to render.
import React, { useEffect, useState } from 'react'
import { View, Image } from 'react-native'
import Svg, { Circle, Rect, Path, Text as SvgText, Defs, Filter, FeTurbulence, FeDisplacementMap, SvgXml } from 'react-native-svg'
import type { Stop } from '../../types'
import { substituteDateInSvg, formatStampDate } from '../../lib/stamp-date-token'

// Module-scoped SVG content cache. A passport with many stops
// sharing the same composed stamp asset fetches each URL once.
// Keyed by URL — recoloring is cheap and happens on read.
const SVG_TEXT_CACHE = new Map<string, string>()
const SVG_INFLIGHT   = new Map<string, Promise<string | null>>()

async function fetchSvgText(url: string): Promise<string | null> {
  const cached = SVG_TEXT_CACHE.get(url)
  if (cached) return cached
  const inflight = SVG_INFLIGHT.get(url)
  if (inflight) return inflight

  const p = (async () => {
    try {
      const res = await fetch(url)
      if (!res.ok) return null
      const text = await res.text()
      SVG_TEXT_CACHE.set(url, text)
      return text
    } catch {
      return null
    }
  })()
  SVG_INFLIGHT.set(url, p)
  try {
    return await p
  } finally {
    SVG_INFLIGHT.delete(url)
  }
}

/** Recolor a composed-stamp SVG. The composer writes every
 *  stroke/fill as the literal string `currentColor`; mobile
 *  has no CSS color cascade, so we replace inline. */
function recolorSvg(svg: string, hex: string): string {
  return svg.replace(/currentColor/g, hex)
}

/** Apply BOTH the per-stop ink recolor AND the per-instance
 *  date-token substitution. Composed in a single helper because
 *  both operations work on the same SVG string and the cached
 *  result is what we hand to <SvgXml>. Order doesn't interact —
 *  `currentColor` never appears inside the {{date}} token.
 *
 *  ctx.earnedAt: the stamp instance's verified_at (UTC timestamptz).
 *    - When provided, the token renders as that date in viewer-local
 *      MM/DD/YYYY (matching "their date" — see spec).
 *    - When omitted with ghost=true, renders em-dashes.
 *    - When omitted with ghost=false, renders today's date as a
 *      sample (the placement-preview path — stamp not yet recorded). */
function prepareStampSvg(
  svg: string,
  hex: string,
  ctx: { earnedAt?: string | null; ghost?: boolean },
): string {
  const recolored = recolorSvg(svg, hex)
  return substituteDateInSvg(recolored, {
    date: formatStampDate(ctx.earnedAt ?? null),
    ghost: !!ctx.ghost,
  })
}

/** A URL points at an SVG asset when its path ends in `.svg`
 *  (the composer's save path is `${user_id}/stamp-${ts}.svg`).
 *  Conservative check — anything else falls back to <Image>. */
function isSvgUrl(url: string | null): boolean {
  if (!url) return false
  return url.toLowerCase().split('?')[0].endsWith('.svg')
}

interface Props {
  stop: Pick<Stop, 'stamp_icon' | 'stamp_color' | 'stamp_shape' | 'stamp_smudge'>
    & Partial<Pick<Stop, 'stamp_type' | 'stamp_asset'>>
  size: number
  rotationDeg?: number
  ghost?: boolean
  // Gesture-derived appearance. When ANY of these is provided (not
  // undefined), the renderer switches into gesture mode and ignores
  // stop.stamp_smudge. saturation defaults to 1 in gesture mode if
  // omitted; smudge components default to no-smear if omitted.
  saturation?: number | null
  smudgeDx?: number | null
  smudgeDy?: number | null
  smudgeIntensity?: number | null
  // When the stamp's SVG contains the {{date}} token (designer
  // inserted it via the composer), substitute it per-instance:
  //   * earnedAt set → format MM/DD/YYYY in viewer-local tz.
  //   * earnedAt nullish AND ghost=true → em-dash placeholder.
  //   * earnedAt nullish AND ghost=false → today's date (sample,
  //                                        placement preview).
  // Stamps without the token are untouched by this prop.
  earnedAt?: string | null
}

function legacySmudgeScale(smudge: Stop['stamp_smudge']): number {
  return { none: 0, light: 2, medium: 5, heavy: 10 }[smudge] ?? 0
}

// Maps continuous smudge intensity to the displacement filter scale.
// Mapping bottoms out at 0 (crisp) and tops out around 12 (heavier than
// the legacy 'heavy' to give the gesture room to express).
function gestureSmudgeScale(intensity: number): number {
  return Math.max(0, Math.min(intensity, 1)) * 12
}

// Trail step count (and per-step offset and opacity attenuation).
// Tuned so a high-intensity smudge gives a clearly readable motion-blur,
// but a low-intensity one is barely visible. Capped at 4 ghosts so the
// rendering cost stays bounded.
function trailSteps(intensity: number): number {
  if (intensity <= 0.05) return 0
  return Math.min(4, Math.ceil(intensity * 5))
}

export function StampArtwork({
  stop,
  size,
  rotationDeg = 0,
  ghost = false,
  saturation,
  smudgeDx,
  smudgeDy,
  smudgeIntensity,
  earnedAt,
}: Props) {
  const isGestureMode =
    saturation != null || smudgeDx != null || smudgeDy != null || smudgeIntensity != null

  const effectiveSaturation = isGestureMode ? (saturation ?? 1) : 1
  const effectiveSmudgeIntensity = isGestureMode ? (smudgeIntensity ?? 0) : 0
  const effectiveSmudgeDx = isGestureMode ? (smudgeDx ?? 0) : 0
  const effectiveSmudgeDy = isGestureMode ? (smudgeDy ?? 0) : 0

  const displacementScale = isGestureMode
    ? gestureSmudgeScale(effectiveSmudgeIntensity)
    : legacySmudgeScale(stop.stamp_smudge)

  const filterId = isGestureMode
    ? `smudge-gesture-${effectiveSmudgeIntensity.toFixed(2)}`
    : `smudge-${stop.stamp_smudge}`

  const opacity = ghost ? 0.3 : effectiveSaturation
  const color = ghost ? stop.stamp_color + '80' : stop.stamp_color

  // Custom-asset mode: render the designer's uploaded artwork.
  // Falls through to default mode when the URL is missing (corrupt link,
  // unresolved join, asset deleted) so the stamp still shows SOMETHING.
  const customAssetUrl = stop.stamp_type === 'custom_asset'
    ? (stop.stamp_asset?.url ?? null)
    : null

  // SVG custom assets re-ink via stamp_color (the composer writes
  // currentColor in every stroke/fill; we replace inline). Raster
  // assets keep their natural colors and skip this fetch.
  const customIsSvg = isSvgUrl(customAssetUrl)
  const [svgRecolored, setSvgRecolored] = useState<string | null>(null)
  useEffect(() => {
    if (!customIsSvg || !customAssetUrl) { setSvgRecolored(null); return }
    let cancelled = false
    void fetchSvgText(customAssetUrl).then((text) => {
      if (cancelled || !text) return
      // Both the ink recolor AND the date-token substitution happen
      // here — the cached SvgXml input reflects the final
      // per-instance render. Re-runs when earnedAt OR ghost OR
      // stamp_color changes (see dep array).
      setSvgRecolored(prepareStampSvg(text, stop.stamp_color, { earnedAt, ghost }))
    })
    return () => { cancelled = true }
  }, [customAssetUrl, customIsSvg, stop.stamp_color, earnedAt, ghost])

  // Filter primitives are undefined on the web SVG renderer
  const filterSupported = !!Filter && !!FeTurbulence && !!FeDisplacementMap
  const useFilter = filterSupported && displacementScale > 0

  // Shape body (default mode). Factored so the trail can reuse it.
  const shapeEl = () => {
    const half = size / 2
    switch (stop.stamp_shape) {
      case 'rectangle':
        return <Rect x="4" y="4" width={size - 8} height={size - 8} rx="4" stroke={color} strokeWidth="2.5" fill="none" />
      case 'hexagon': {
        const r = half - 4
        const pts = Array.from({ length: 6 }, (_, i) => {
          const a = (Math.PI / 3) * i - Math.PI / 6
          return `${half + r * Math.cos(a)},${half + r * Math.sin(a)}`
        }).join(' ')
        return <Path d={`M ${pts} Z`} stroke={color} strokeWidth="2.5" fill="none" />
      }
      case 'badge': {
        const pts = `${half},4 ${size - 4},${size * 0.35} ${size * 0.8},${size - 4} ${size * 0.2},${size - 4} 4,${size * 0.35}`
        return <Path d={`M ${pts} Z`} stroke={color} strokeWidth="2.5" fill="none" />
      }
      default:
        return <Circle cx={half} cy={half} r={half - 4} stroke={color} strokeWidth="2.5" fill="none" />
    }
  }

  // Single stamp body — used both for the primary stamp and the trail
  // ghosts. Renders either the custom asset image or the shape+emoji
  // based on artwork mode. Gesture-mode FeDisplacementMap noise is
  // applied to BOTH modes uniformly so smudge behavior matches.
  const stampBody = (filterRef: string | null, opacityOverride?: number) => {
    if (customAssetUrl) {
      // SVG branch (composed stamps): render the recolored SVG
      // via SvgXml. currentColor was replaced in-place at fetch
      // time so the stamp re-inks with stamp_color the way it
      // does in the web designer canvas. Filter doesn't apply
      // to SvgXml (same reason as the raster path below) — the
      // trail ghosts carry the smudge feel.
      if (customIsSvg) {
        if (!svgRecolored) {
          // Loading — return an empty View so the stamp slot
          // reserves space without flashing the default shape.
          return <View style={{ width: size, height: size }} />
        }
        return (
          <View
            style={{
              width: size,
              height: size,
              opacity: (opacityOverride ?? 1) * (ghost ? 0.6 : 1),
            }}
          >
            <SvgXml xml={svgRecolored} width={size} height={size} />
          </View>
        )
      }

      // Raster branch (uploaded PNG/JPG). The displacement filter
      // doesn't apply to a raster <Image> in RN, so we approximate
      // the "noisy edges" by letting the trail-ghost density carry
      // the smudge feel and skipping the filter on the image itself.
      return (
        <Image
          source={{ uri: customAssetUrl }}
          style={{
            width: size,
            height: size,
            opacity: (opacityOverride ?? 1) * (ghost ? 0.6 : 1),
          }}
          resizeMode="contain"
        />
      )
    }

    return (
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} opacity={opacityOverride ?? 1}>
        {useFilter && filterRef && (
          <Defs>
            <Filter id={filterRef} x="-10%" y="-10%" width="120%" height="120%">
              <FeTurbulence type="turbulence" baseFrequency="0.65" numOctaves="3" seed="2" />
              <FeDisplacementMap in="SourceGraphic" scale={displacementScale} xChannelSelector="R" yChannelSelector="G" />
            </Filter>
          </Defs>
        )}
        <Svg width={size} height={size} filter={useFilter && filterRef ? `url(#${filterRef})` : undefined}>
          {shapeEl()}
          <SvgText
            x={size / 2}
            y={size / 2 + size * 0.12}
            fontSize={size * 0.38}
            textAnchor="middle"
            fill={ghost ? color : stop.stamp_color}
          >
            {stop.stamp_icon}
          </SvgText>
        </Svg>
      </Svg>
    )
  }

  // Directional ghost trail. Each step is the stamp body offset along
  // the smudge direction with declining opacity. The trail is rendered
  // BEHIND the primary stamp so the primary reads clearly. Works for
  // both custom-asset and shape+emoji modes — stampBody handles both.
  const steps = isGestureMode ? trailSteps(effectiveSmudgeIntensity) : 0
  const stepOffsetPx = size * 0.12 * effectiveSmudgeIntensity
  const ghostNodes: React.ReactNode[] = []
  for (let i = 1; i <= steps; i++) {
    const t = i / (steps + 1) // 0..1 within trail
    const offsetX = effectiveSmudgeDx * stepOffsetPx * i
    const offsetY = effectiveSmudgeDy * stepOffsetPx * i
    const trailOpacity = (1 - t) * 0.45 // back ghosts more transparent
    ghostNodes.push(
      <View
        key={`trail-${i}`}
        style={{
          position: 'absolute',
          left: offsetX,
          top: offsetY,
          width: size,
          height: size,
        }}
        pointerEvents="none"
      >
        {stampBody(`${filterId}-trail-${i}`, trailOpacity)}
      </View>,
    )
  }

  return (
    <View style={{ width: size, height: size, transform: [{ rotate: `${rotationDeg}deg` }], opacity }}>
      {ghostNodes}
      {stampBody(filterId)}
    </View>
  )
}
