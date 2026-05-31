// Expressive stamp gesture — proxy version (no native contact-geometry reads).
//
// PATENT POSTURE: This component is the JS proxy implementation explicitly
// described in the build prompt's framing note. Size and orientation are
// PROXIES, not measured fingertip contact area or contact-ellipse angle:
//
//   size       <- press duration (0..2s), eased
//   saturation <- press duration (0..2s), eased (coupled to size)
//   rotation   <- direction of the finger's initial drift in the first
//                 ~INITIAL_VECTOR_WINDOW_MS of the press
//   smudge     <- total path traveled during the press (real read, not a
//                 proxy); rendered as a directional motion-blur trail
//                 along the net travel direction
//
// True contact-area / contact-ellipse reads are deferred (Path A) and out
// of scope for this PR by design — no native module, no expo prebuild.
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

const MAX_DURATION_MS = 2000
const INITIAL_VECTOR_WINDOW_MS = 200
const INITIAL_VECTOR_MIN_DRIFT_PX = 6 // ignore micro-jitter under this magnitude
const MIN_SIZE_PX = 36
const MAX_SIZE_PX = 96
const MIN_SATURATION = 0.45
const MAX_SATURATION = 1.0
const SMUDGE_FULL_PATH_PX = 80 // path length that maps to smudge intensity 1.0
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
  }>({
    active: false,
    localX: 0,
    localY: 0,
    progress: 0,
    rotationDeg: 0,
    smudgeDx: 0,
    smudgeDy: 0,
    smudgeIntensity: 0,
  })

  const cleanup = useCallback(() => {
    activeRef.current = false
    startTimeRef.current = 0
    pathLengthRef.current = 0
    initialVectorRef.current = null
    initialVectorLockedRef.current = false
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
      // Touch start was outside the box. Silent no-op consistent with the
      // legacy StampPressInteraction behavior.
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
    })
  }, [boxLayout, stop, computeCurrentSmudge, onStampPlaced, onPressCancel, cleanup])

  const updatePreview = useCallback(() => {
    if (!activeRef.current) return
    const elapsed = Math.min(Date.now() - startTimeRef.current, MAX_DURATION_MS)
    const rawT = elapsed / MAX_DURATION_MS
    const eased = easeOutCubic(rawT)
    const rotationDeg = initialVectorRef.current
      ? (Math.atan2(initialVectorRef.current.dy, initialVectorRef.current.dx) * 180) / Math.PI
      : 0
    const { smudgeDx, smudgeDy, smudgeIntensity } = computeCurrentSmudge()
    setPreview((p) => ({
      ...p,
      progress: eased,
      rotationDeg,
      smudgeDx,
      smudgeDy,
      smudgeIntensity,
    }))
  }, [computeCurrentSmudge])

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

  return (
    <View
      style={[styles.container, { width: boxLayout.width, height: boxLayout.height }]}
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
          />
        </View>
      )}
    </View>
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
