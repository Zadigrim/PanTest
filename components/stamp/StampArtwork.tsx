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
import { View, Platform } from 'react-native'
import Svg, { Circle, Rect, Path, Text as SvgText, Defs, Filter, FeTurbulence, FeDisplacementMap, SvgXml, LinearGradient, Stop as GradientStop, Mask, G, Image as SvgImage } from 'react-native-svg'
import type { Stop } from '../../types'
import { substituteDateInSvg, formatStampDate } from '../../lib/stamp-date-token'
import { hexColor } from '../../lib/colors'

// Tilt lightening is paper-agnostic: it reduces the stamp's OWN ink alpha
// along the lift axis (a directional mask), so the page beneath shows
// through on any background color. No paper-tone color is injected — see
// the tilt mask in stampBody. (Previously a hardcoded cream wash, which
// only read correctly on light/cream pages.)

// How far (fraction of full ink) the lifted edge thins at tilt intensity 1.
// Mirrors the prior wash strength (0.6) so the feel is unchanged.
const TILT_MAX_REDUCTION = 0.6

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
  // Tilt (migration 083): unit vector toward the PRESSED (darker) edge;
  // the opposite edge lifts and is washed lighter, scaled by
  // tiltIntensity (0..1). Any non-null tilt prop also engages gesture
  // mode. Absent → no tilt wash (flat ink).
  tiltDx?: number | null
  tiltDy?: number | null
  tiltIntensity?: number | null
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

// Smear sampling. The trail is rendered as N overlapping copies of the
// stamp body along the smudge vector with a SMOOTH opacity falloff — a
// continuous gradient from the full first impression to a faint last
// one, not a few visibly-separate repeats. Density scales with
// intensity (up to SMEAR_MAX_STEPS) and the copies OVERLAP (offset per
// step is a fraction of the body) so there are no gaps. Trail copies are
// filterless (the FeTurbulence displacement runs only on the primary),
// which keeps the higher count cheap.
const SMEAR_MAX_STEPS = 12
function trailSteps(intensity: number): number {
  if (intensity <= 0.05) return 0
  return Math.min(SMEAR_MAX_STEPS, Math.max(2, Math.round(intensity * SMEAR_MAX_STEPS)))
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
  tiltDx,
  tiltDy,
  tiltIntensity,
  earnedAt,
}: Props) {
  const isGestureMode =
    saturation != null || smudgeDx != null || smudgeDy != null || smudgeIntensity != null ||
    tiltDx != null || tiltDy != null || tiltIntensity != null

  const effectiveSaturation = isGestureMode ? (saturation ?? 1) : 1
  const effectiveSmudgeIntensity = isGestureMode ? (smudgeIntensity ?? 0) : 0
  const effectiveSmudgeDx = isGestureMode ? (smudgeDx ?? 0) : 0
  const effectiveSmudgeDy = isGestureMode ? (smudgeDy ?? 0) : 0
  const effectiveTiltIntensity = isGestureMode ? (tiltIntensity ?? 0) : 0
  const effectiveTiltDx = isGestureMode ? (tiltDx ?? 0) : 0
  const effectiveTiltDy = isGestureMode ? (tiltDy ?? 0) : 0

  // Tilt geometry. The lift unit vector L = -(tiltDx, tiltDy) points from
  // the pressed (darker, full-ink) edge toward the lifted (lighter) edge.
  // We reduce ink alpha along L via a directional mask (see stampBody).
  const tiltMag = Math.sqrt(effectiveTiltDx * effectiveTiltDx + effectiveTiltDy * effectiveTiltDy)
  const showTilt = isGestureMode && effectiveTiltIntensity > 0.04 && tiltMag > 0.001
  // Gradient endpoints in objectBoundingBox space (0..1): pressed -> lifted.
  const lx = showTilt ? -effectiveTiltDx / tiltMag : 0
  const ly = showTilt ? -effectiveTiltDy / tiltMag : 0
  const tiltX1 = 0.5 - lx * 0.5
  const tiltY1 = 0.5 - ly * 0.5
  const tiltX2 = 0.5 + lx * 0.5
  const tiltY2 = 0.5 + ly * 0.5
  // Max alpha removed at the lifted edge, scaled by intensity.
  const tiltMaxReduction = Math.min(effectiveTiltIntensity, 1) * TILT_MAX_REDUCTION
  // A stable-per-render mask id (parameterized like the smudge filter id to
  // avoid cross-stamp <Defs> id collisions on the web SVG renderer).
  const tiltMaskId = `tilt-${effectiveTiltDx.toFixed(2)}-${effectiveTiltDy.toFixed(2)}-${effectiveTiltIntensity.toFixed(2)}`

  // Directional ink-reduction mask. White (full luminance) at the pressed
  // edge with a stopOpacity ramp toward the lifted edge — the mask alpha
  // multiplies the ink's alpha, so the lifted edge thins and reveals the
  // page. No color is added. Rendered into each artwork mode's <Svg> so the
  // reduction is identical across shape, composed-SVG, and raster stamps.
  const tiltMaskDefs = showTilt ? (
    <Defs>
      <LinearGradient id={`${tiltMaskId}-grad`} x1={tiltX1} y1={tiltY1} x2={tiltX2} y2={tiltY2}>
        <GradientStop offset="0" stopColor="#fff" stopOpacity={1} />
        <GradientStop offset="0.55" stopColor="#fff" stopOpacity={1 - tiltMaxReduction * 0.4} />
        <GradientStop offset="1" stopColor="#fff" stopOpacity={1 - tiltMaxReduction} />
      </LinearGradient>
      <Mask id={tiltMaskId} x="0" y="0" width={size} height={size} maskUnits="userSpaceOnUse">
        <Rect x="0" y="0" width={size} height={size} fill={`url(#${tiltMaskId}-grad)`} />
      </Mask>
    </Defs>
  ) : null

  const displacementScale = isGestureMode
    ? gestureSmudgeScale(effectiveSmudgeIntensity)
    : legacySmudgeScale(stop.stamp_smudge)

  const filterId = isGestureMode
    ? `smudge-gesture-${effectiveSmudgeIntensity.toFixed(2)}`
    : `smudge-${stop.stamp_smudge}`

  const opacity = ghost ? 0.3 : effectiveSaturation
  const color = ghost ? hexColor(stop.stamp_color) + '80' : hexColor(stop.stamp_color)

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
      setSvgRecolored(prepareStampSvg(text, hexColor(stop.stamp_color), { earnedAt, ghost }))
    })
    return () => { cancelled = true }
  }, [customAssetUrl, customIsSvg, stop.stamp_color, earnedAt, ghost])

  // Filter primitives are undefined on the web SVG renderer, and although
  // they're defined on native, react-native-svg does NOT implement
  // FeTurbulence/FeDisplacementMap there — it logs a "filters not yet
  // supported on native platforms" warning on every stamp render for zero
  // visual effect. So the displacement filter renders on no platform; gate it
  // off on native too (web is already skipped since the primitives are
  // undefined) to keep the console clean. Revisit if native support lands.
  const filterSupported = !!Filter && !!FeTurbulence && !!FeDisplacementMap
  const useFilter = filterSupported && displacementScale > 0 && Platform.OS === 'web'

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
  // ghosts. Renders the custom asset (composed SVG or raster) or the
  // shape+emoji, always inside one <Svg> so the directional tilt mask can
  // apply uniformly across every artwork mode (paper-agnostic ink
  // reduction). Gesture-mode FeDisplacementMap noise applies to the
  // shape mode. applyTilt is true only for the primary impression; the
  // trail ghosts (applyTilt=false) are not tilt-masked.
  const stampBody = (
    filterRef: string | null,
    opacityOverride?: number,
    applyTilt = false,
  ) => {
    const useTilt = applyTilt && showTilt
    // Wrap content in the tilt mask group when active; otherwise pass through.
    const withTilt = (content: React.ReactNode) =>
      useTilt ? <G mask={`url(#${tiltMaskId})`}>{content}</G> : content
    const bodyOpacity = (opacityOverride ?? 1) * (ghost ? 0.6 : 1)

    if (customAssetUrl) {
      // Composed-SVG branch: render the recolored SVG via SvgXml. The
      // displacement filter doesn't apply here — the trail ghosts carry
      // the smudge feel. The tilt mask DOES apply (the page reads through
      // the lifted edge regardless of page color).
      if (customIsSvg) {
        if (!svgRecolored) {
          // Loading — empty box so the slot reserves space without flashing.
          return <View style={{ width: size, height: size }} />
        }
        return (
          <Svg width={size} height={size} opacity={bodyOpacity}>
            {tiltMaskDefs}
            {withTilt(<SvgXml xml={svgRecolored} width={size} height={size} />)}
          </Svg>
        )
      }

      // Raster branch (uploaded PNG/JPG). Rendered via react-native-svg's
      // <Image> (not RN core Image) so the same tilt mask applies. The
      // displacement filter still doesn't apply to a raster image; ghost
      // density carries the smudge feel.
      return (
        <Svg width={size} height={size} opacity={bodyOpacity}>
          {tiltMaskDefs}
          {withTilt(
            <SvgImage
              href={{ uri: customAssetUrl }}
              width={size}
              height={size}
              preserveAspectRatio="xMidYMid meet"
            />,
          )}
        </Svg>
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
        {tiltMaskDefs}
        {withTilt(
          <Svg width={size} height={size} filter={useFilter && filterRef ? `url(#${filterRef})` : undefined}>
            {shapeEl()}
            <SvgText
              x={size / 2}
              y={size / 2 + size * 0.12}
              fontSize={size * 0.38}
              textAnchor="middle"
              fill={ghost ? color : hexColor(stop.stamp_color)}
            >
              {stop.stamp_icon}
            </SvgText>
          </Svg>,
        )}
      </Svg>
    )
  }

  // Directional smear. N overlapping copies of the stamp body stepped
  // along the smudge vector with a SMOOTH opacity falloff, so the result
  // reads as a continuous gradient from the full first impression to a
  // faint trailing one — not a handful of separate repeats. The total
  // smear span matches the prior feel (~0.5·size at full intensity); the
  // higher step count just fills the gaps. Ghosts are FILTERLESS (null
  // filterRef) so the extra copies stay cheap — only the primary carries
  // the FeTurbulence displacement. Rendered BEHIND the primary.
  const steps = isGestureMode ? trailSteps(effectiveSmudgeIntensity) : 0
  const smearSpanPx = size * 0.5 * effectiveSmudgeIntensity
  const ghostNodes: React.ReactNode[] = []
  for (let i = 1; i <= steps; i++) {
    const t = i / steps // 0..1 along the smear; 1 = farthest/faintest
    const offsetX = effectiveSmudgeDx * smearSpanPx * t
    const offsetY = effectiveSmudgeDy * smearSpanPx * t
    // Smooth falloff: near-full close to the primary, fading toward 0 at
    // the tail. The ^1.4 curve keeps the body of the smear inky and only
    // the far end wispy, which reads as a real drag rather than a fan.
    const trailOpacity = Math.pow(1 - t, 1.4) * 0.5
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
        {stampBody(null, trailOpacity)}
      </View>,
    )
  }

  // Tilt is no longer a color overlay — it's a directional reduction of the
  // ink's own alpha, applied inside stampBody via tiltMaskDefs/tiltMaskId
  // (see the geometry computed near the top of the component). The lifted
  // edge thins so the actual page color shows through, on any background.

  return (
    <View style={{ width: size, height: size, transform: [{ rotate: `${rotationDeg}deg` }], opacity }}>
      {ghostNodes}
      {stampBody(filterId, undefined, true)}
    </View>
  )
}
