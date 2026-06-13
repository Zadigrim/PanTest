// JS surface for the okuji-touch native view.
//
// The view is a non-intrusive observer: it wraps the stamp gesture area
// and reports the contact-ellipse geometry of the active touch WITHOUT
// consuming the touch — the PanResponder underneath still runs the
// gesture. On Android the geometry is a real MotionEvent read (touch
// major/minor + orientation). On iOS the view is a plain passthrough
// (no finger contact-orientation API exists) and emits nothing, so the
// JS side falls back to the drift proxy.
//
// Feature-detected: requireNativeViewManager throws if the native module
// isn't registered in this binary (e.g. an Expo Go / dev client without
// the module, or a build where autolinking didn't pick it up). The
// parent (StampGestureInteraction) guards against that and renders a
// plain View instead, so stamping never depends on this module loading.
import * as React from 'react'
import { requireNativeViewManager } from 'expo-modules-core'
import type { ViewProps } from 'react-native'

export interface TouchGeometryPayload {
  // 'began' | 'moved' | 'ended'
  phase: string
  // Unit vector toward the PRESSED (darker) edge, in view-local space.
  // Zero when no directional read is available.
  dx: number
  dy: number
  // 0..1 ellipse eccentricity → tilt amount. 0 = isotropic (flat press).
  intensity: number
}

export interface OkujiTouchViewProps extends ViewProps {
  onTouchGeometry?: (e: { nativeEvent: TouchGeometryPayload }) => void
}

const NativeView = requireNativeViewManager<OkujiTouchViewProps>('OkujiTouch')

export function OkujiTouchView(props: OkujiTouchViewProps) {
  return <NativeView {...props} />
}
