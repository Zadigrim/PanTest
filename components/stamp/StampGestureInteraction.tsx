// Expressive stamp gesture.
//
// POSTURE: size / saturation / rotation remain JS PROXIES (no native read):
//
//   size       <- press duration (0..2s), eased
//   saturation <- press duration (0..2s), eased (coupled to size)
//   rotation   <- direction of the finger's initial drift in the first
//                 ~INITIAL_VECTOR_WINDOW_MS of the press
//   smudge     <- total path traveled during the press (real read, not a
//                 proxy); rendered as a directional motion-blur trail
//                 along the net travel direction
//
// TILT activates Path A — the previously-deferred native contact-ellipse
// read — on Android only, via the local okuji-touch module
// (MotionEvent touch major/minor + orientation). iOS has no finger
// contact-orientation API, so iOS keeps a drift-direction PROXY for tilt.
// The native read is feature-detected and non-intrusive (the module reads
// geometry in dispatchTouchEvent then calls super, so this PanResponder
// runs unchanged); when the module is absent the proxy is used. See
// modules/okuji-touch/README.md for the deliberate posture change.
//
// CENTER-WITHIN / EDGES-FREE rule (patent-relevant, preserved): the stamp's
// CENTER is the touch START position. computeStampPlacement() rejects
// centers outside the LocationBox; edges may extend past the box at render
// time with no clipping. The render layer (StampSlot / StampCanvas) is
// responsible for the edges-free part — see those components.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { View, StyleSheet, PanResponder, type LayoutRectangle, type GestureResponderEvent, type PanResponderGestureState } from 'react-native'
import { StampArtwork } from './StampArtwork'
import { computeStampPlacement } from '../../lib/stamp'
import type { Stop, StampSlotState, StampPlacement } from '../../types'
// Feature-detected native contact-geometry view. Null on iOS-proxy
// builds, dev clients without the module, or any binary where the module
// wasn't autolinked — the gesture then renders a plain View and tilt uses
// the drift proxy. Importing never hard-fails (see modules/okuji-touch).
import { OkujiTouchView, type TouchGeometryPayload } from '../../modules/okuji-touch'

const MAX_DURATION_MS = 2000
const INITIAL_VECTOR_WINDOW_MS = 200
const INITIAL_VECTOR_MIN_DRIFT_PX = 6 // ignore micro-jitter under this magnitude
const MIN_SIZE_PX = 36
const MAX_SIZE_PX = 96
const MIN_SATURATION = 0.45
const MAX_SATURATION = 1.0
const SMUDGE_FULL_PATH_PX = 80 // path length that maps to smudge intensity 1.0
const TILT_FULL_NET_PX = 40 // NET displacement that maps to proxy tilt 1.0
const PREVIEW_TICK_MS = 50 // preview refresh rate during press

// Easing: feel physical, not linear — fast ramp up, settle near the cap.
// Cubic out gives a noticeable initial growth then gentle approach.
function easeOutCubic(t: number): number {
  const u = 1 - t
  return 1 - u * u * u
}

interface Props {
  stop: Stop
  slotState: StampSlotState
  boxLayout: LayoutRectangle
  onPressStart: () => void
  onPressCancel: () => void
  onStampPlaced: (placement: StampPlacement) => void
}

export function StampGestureInteraction({
  stop,
  slotState,
  boxLayout,
  onPressStart,
  onPressCancel,
  onStampPlaced,
}: Props) {
  // ── Gesture-state refs (used during the press; not React state to avoid
  // tearing down PanResponder on each tick). ────────────────────────────
  const startTimeRef = useRef(0)
  const startPagePosRef = useRef({ x: 0, y: 0 })
  const lastPagePosRef = useRef({ x: 0, y: 0 })
  const pathLengthRef = useRef(0)
  // initialVectorRef stays null until the user has either moved beyond the
  // jitter threshold within the window, or the window has elapsed.
  const initialVectorRef = useRef<{ dx: number; dy: number } | null>(null)
  const initialVectorLockedRef = useRef(false)
  // Native contact-ellipse tilt (Android, via the okuji-touch module).
  // Populated by onTouchGeometry events when the native module is
  // present; null otherwise (iOS, or module unavailable) → tilt falls
  // back to the drift proxy in computeCurrentTilt(). { ...measured }.
  const nativeTiltRef = useRef<{ dx: number; dy: number; intensity: number } | null>(null)
  const autoCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const previewTickRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const activeRef = useRef(false)

  // ── Live preview state (drives the on-screen stamp that grows during
  // the press). Updated on a ~50ms tick + on every move event so the user
  // sees the gesture forming. ────────────────────────────────────────────
  const [preview, setPreview] = useState<{
    active: boolean
    localX: number
    localY: number
    progress: number // 0..1, eased
    rotationDeg: number
    smudgeDx: number
    smudgeDy: number
    smudgeIntensity: number
    tiltDx: number
    tiltDy: number
    tiltIntensity: number
  }>({
    active: false,
    localX: 0,
    localY: 0,
    progress: 0,
    rotationDeg: 0,
    smudgeDx: 0,
    smudgeDy: 0,
    smudgeIntensity: 0,
    tiltDx: 0,
    tiltDy: 0,
    tiltIntensity: 0,
  })

  const cleanup = useCallback(() => {
    activeRef.current = false
    startTimeRef.current = 0
    pathLengthRef.current = 0
    initialVectorRef.current = null
    initialVectorLockedRef.current = false
    nativeTiltRef.current = null
    if (autoCommitTimerRef.current) {
      clearTimeout(autoCommitTimerRef.current)
      autoCommitTimerRef.current = null
    }
    if (previewTickRef.current) {
      clearInterval(previewTickRef.current)
      previewTickRef.current = null
    }
    setPreview((p) => ({ ...p, active: false }))
  }, [])

  // Unmount safety — cancel any in-flight timers/animations.
  useEffect(() => cleanup, [cleanup])

  const computeCurrentSmudge = useCallback(() => {
    const dxNet = lastPagePosRef.current.x - startPagePosRef.current.x
    const dyNet = lastPagePosRef.current.y - startPagePosRef.current.y
    const mag = Math.sqrt(dxNet * dxNet + dyNet * dyNet)
    const intensity = Math.min(pathLengthRef.current / SMUDGE_FULL_PATH_PX, 1)
    let smudgeDx = 0
    let smudgeDy = 0
    if (intensity > 0.05 && mag > 0) {
      smudgeDx = dxNet / mag
      smudgeDy = dyNet / mag
    }
    return { smudgeDx, smudgeDy, smudgeIntensity: intensity }
  }, [])

  // Tilt. Measured contact-ellipse wins (Android, native module) — it's a
  // real read of how the fingertip rocked. Otherwise the proxy: the stamp
  // leans toward the finger's NET travel (leading edge presses darker,
  // trailing edge lifts lighter). Net displacement, not path length, so a
  // straight drag tilts strongly while a back-and-forth wiggle (high path,
  // low net) smears without tilting — physically what you'd expect.
  const computeCurrentTilt = useCallback(() => {
    const measured = nativeTiltRef.current
    if (measured && measured.intensity > 0) {
      return { tiltDx: measured.dx, tiltDy: measured.dy, tiltIntensity: measured.intensity }
    }
    const dxNet = lastPagePosRef.current.x - startPagePosRef.current.x
    const dyNet = lastPagePosRef.current.y - startPagePosRef.current.y
    const mag = Math.sqrt(dxNet * dxNet + dyNet * dyNet)
    const intensity = Math.min(mag / TILT_FULL_NET_PX, 1)
    let tiltDx = 0
    let tiltDy = 0
    if (intensity > 0.04 && mag > 0) {
      tiltDx = dxNet / mag
      tiltDy = dyNet / mag
    }
    return { tiltDx, tiltDy, tiltIntensity: intensity }
  }, [])

  const commit = useCallback(() => {
    if (!activeRef.current || !startTimeRef.current) return

    const elapsed = Math.min(Date.now() - startTimeRef.current, MAX_DURATION_MS)
    const rawT = elapsed / MAX_DURATION_MS
    const eased = easeOutCubic(rawT)

    const size = MIN_SIZE_PX + (MAX_SIZE_PX - MIN_SIZE_PX) * eased
    const saturation = MIN_SATURATION + (MAX_SATURATION - MIN_SATURATION) * eased

    // Rotation: use the captured initial vector. Subtle randomization if
    // the user did not drift at all, so the stamp doesn't look perfectly
    // axis-aligned with the page. stamp_rotation_fixed on the stop wins
    // when set (curator-locked stamp orientation).
    let rotationDeg = 0
    if (initialVectorRef.current) {
      const { dx, dy } = initialVectorRef.current
      rotationDeg = (Math.atan2(dy, dx) * 180) / Math.PI
    } else {
      rotationDeg = (Math.random() * 2 - 1) * 4 // ±4° natural-looking jitter
    }
    if (stop.stamp_rotation_fixed != null) {
      rotationDeg = stop.stamp_rotation_fixed
    }

    const { smudgeDx, smudgeDy, smudgeIntensity } = computeCurrentSmudge()
    const { tiltDx, tiltDy, tiltIntensity } = computeCurrentTilt()

    // Center-within-box rule: validate via the existing helper. Passes
    // contactRadius = size/2; the helper only uses it for the returned
    // contactSizePx (we override below with the gesture's size).
    const placement = computeStampPlacement(
      startPagePosRef.current.x,
      startPagePosRef.current.y,
      boxLayout.x,
      boxLayout.y,
      boxLayout.width,
      boxLayout.height,
      size / 2,
      stop,
    )

    cleanup()

    if (!placement) {
      // Touch start was outside the box. Silent no-op — center-within-box
      // rule enforced by computeStampPlacement().
      onPressCancel()
      return
    }

    onStampPlaced({
      posX: placement.posX,
      posY: placement.posY,
      contactSizePx: size,
      rotationDeg, // gesture-derived; overrides the helper's random/fixed
      saturation,
      smudgeDx,
      smudgeDy,
      smudgeIntensity,
      tiltDx,
      tiltDy,
      tiltIntensity,
    })
  }, [boxLayout, stop, computeCurrentSmudge, computeCurrentTilt, onStampPlaced, onPressCancel, cleanup])

  const updatePreview = useCallback(() => {
    if (!activeRef.current) return
    const elapsed = Math.min(Date.now() - startTimeRef.current, MAX_DURATION_MS)
    const rawT = elapsed / MAX_DURATION_MS
    const eased = easeOutCubic(rawT)
    const rotationDeg = initialVectorRef.current
      ? (Math.atan2(initialVectorRef.current.dy, initialVectorRef.current.dx) * 180) / Math.PI
      : 0
    const { smudgeDx, smudgeDy, smudgeIntensity } = computeCurrentSmudge()
    const { tiltDx, tiltDy, tiltIntensity } = computeCurrentTilt()
    setPreview((p) => ({
      ...p,
      progress: eased,
      rotationDeg,
      smudgeDx,
      smudgeDy,
      smudgeIntensity,
      tiltDx,
      tiltDy,
      tiltIntensity,
    }))
  }, [computeCurrentSmudge, computeCurrentTilt])

  const handleGrant = useCallback((evt: GestureResponderEvent) => {
    if (slotState !== 'ready') return
    const now = Date.now()
    activeRef.current = true
    startTimeRef.current = now
    pathLengthRef.current = 0
    initialVectorRef.current = null
    initialVectorLockedRef.current = false
    const { pageX, pageY } = evt.nativeEvent
    startPagePosRef.current = { x: pageX, y: pageY }
    lastPagePosRef.current = { x: pageX, y: pageY }

    onPressStart()

    setPreview({
      active: true,
      localX: pageX - boxLayout.x,
      localY: pageY - boxLayout.y,
      progress: 0,
      rotationDeg: 0,
      smudgeDx: 0,
      smudgeDy: 0,
      smudgeIntensity: 0,
      tiltDx: 0,
      tiltDy: 0,
      tiltIntensity: 0,
    })

    // Auto-commit at the 2s cap.
    autoCommitTimerRef.current = setTimeout(() => {
      commit()
    }, MAX_DURATION_MS)

    // Preview refresh tick.
    previewTickRef.current = setInterval(updatePreview, PREVIEW_TICK_MS)
  }, [slotState, boxLayout.x, boxLayout.y, onPressStart, commit, updatePreview])

  const handleMove = useCallback((evt: GestureResponderEvent, _gs: PanResponderGestureState) => {
    if (!activeRef.current) return
    const { pageX, pageY } = evt.nativeEvent

    const dxStep = pageX - lastPagePosRef.current.x
    const dyStep = pageY - lastPagePosRef.current.y
    pathLengthRef.current += Math.sqrt(dxStep * dxStep + dyStep * dyStep)
    lastPagePosRef.current = { x: pageX, y: pageY }

    // Lock the initial vector once: either when the user has drifted past
    // the jitter threshold within the window, or when the window expires.
    if (!initialVectorLockedRef.current) {
      const elapsed = Date.now() - startTimeRef.current
      const dxFromStart = pageX - startPagePosRef.current.x
      const dyFromStart = pageY - startPagePosRef.current.y
      const drift = Math.sqrt(dxFromStart * dxFromStart + dyFromStart * dyFromStart)
      if (drift >= INITIAL_VECTOR_MIN_DRIFT_PX) {
        initialVectorRef.current = { dx: dxFromStart, dy: dyFromStart }
        initialVectorLockedRef.current = true
      } else if (elapsed >= INITIAL_VECTOR_WINDOW_MS) {
        // Window elapsed without enough drift — leave initialVector null
        // (commit() will treat that as "no drift, apply jitter").
        initialVectorLockedRef.current = true
      }
    }
    // Live preview state will pick up changes on the next tick.
  }, [])

  const handleRelease = useCallback(() => {
    if (!activeRef.current) return
    commit()
  }, [commit])

  const handleTerminate = useCallback(() => {
    if (!activeRef.current) return
    cleanup()
    onPressCancel()
  }, [cleanup, onPressCancel])

  // Native contact-ellipse events (Android). The major axis is undirected
  // (two ends), so we resolve which end is the PRESSED/darker edge by
  // aligning it with the finger's net drift; with no drift yet we keep the
  // axis as-is. Stored in nativeTiltRef so computeCurrentTilt() prefers it
  // over the proxy. iOS emits nothing → ref stays null → proxy.
  const handleTouchGeometry = useCallback((e: { nativeEvent: TouchGeometryPayload }) => {
    if (!activeRef.current) return
    const { dx, dy, intensity } = e.nativeEvent
    if (!(intensity > 0) || (dx === 0 && dy === 0)) {
      nativeTiltRef.current = null
      return
    }
    let ax = dx
    let ay = dy
    const driftX = lastPagePosRef.current.x - startPagePosRef.current.x
    const driftY = lastPagePosRef.current.y - startPagePosRef.current.y
    if (driftX * ax + driftY * ay < 0) {
      // Flip the axis to the end the finger is leaning toward.
      ax = -ax
      ay = -ay
    }
    nativeTiltRef.current = { dx: ax, dy: ay, intensity: Math.max(0, Math.min(intensity, 1)) }
  }, [])

  // PanResponder.create captures its callbacks at construction time, so
  // a useRef-wrapped instance would freeze stale closures. useMemo keyed
  // on the input callbacks gives a fresh PanResponder whenever the
  // closure-relevant deps change. Reconstruction is cheap and infrequent.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => slotState === 'ready',
        onMoveShouldSetPanResponder: () => slotState === 'pressing',
        onPanResponderGrant: handleGrant,
        onPanResponderMove: handleMove,
        onPanResponderRelease: handleRelease,
        onPanResponderTerminate: handleTerminate,
      }),
    [slotState, handleGrant, handleMove, handleRelease, handleTerminate],
  )

  const showPreview = preview.active && slotState === 'pressing'
  // Preview size: linear interp by the eased progress (matches what
  // commit() will compute on release).
  const previewSize = MIN_SIZE_PX + (MAX_SIZE_PX - MIN_SIZE_PX) * preview.progress
  const previewSaturation = MIN_SATURATION + (MAX_SATURATION - MIN_SATURATION) * preview.progress

  // The native observer wraps the gesture container WITHOUT consuming
  // touches (it reads geometry in dispatchTouchEvent then calls super),
  // so PanResponder underneath runs unchanged. When the module isn't in
  // the binary, OkujiTouchView is null and we render a plain wrapper.
  const Wrapper = OkujiTouchView ?? View
  const wrapperProps = OkujiTouchView ? { onTouchGeometry: handleTouchGeometry } : {}

  return (
    <Wrapper
      style={[styles.container, { width: boxLayout.width, height: boxLayout.height }]}
      {...wrapperProps}
      {...panResponder.panHandlers}
    >
      {showPreview && (
        <View
          pointerEvents="none"
          style={[
            styles.previewWrap,
            {
              left: preview.localX - previewSize / 2,
              top: preview.localY - previewSize / 2,
              width: previewSize,
              height: previewSize,
            },
          ]}
        >
          <StampArtwork
            stop={stop}
            size={previewSize}
            rotationDeg={preview.rotationDeg}
            saturation={previewSaturation}
            smudgeDx={preview.smudgeDx}
            smudgeDy={preview.smudgeDy}
            smudgeIntensity={preview.smudgeIntensity}
            tiltDx={preview.tiltDx}
            tiltDy={preview.tiltDy}
            tiltIntensity={preview.tiltIntensity}
          />
        </View>
      )}
    </Wrapper>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    overflow: 'visible',
  },
  previewWrap: {
    position: 'absolute',
    overflow: 'visible',
  },
})
