import ExpoModulesCore

// iOS contact-geometry is a deliberate NO-OP.
//
// UITouch exposes `majorRadius` (contact size) but provides NO finger
// contact-ellipse ORIENTATION — azimuth/altitude are Apple Pencil only.
// Directional tilt therefore can't be measured from a finger on iOS, so
// this view simply hosts its React children and emits nothing. The JS
// side (StampGestureInteraction) sees no native geometry on iOS and
// falls back to the drift-direction tilt proxy. The view exists only so
// the cross-platform <OkujiTouchView> mounts identically on both OSes.
class OkujiTouchView: ExpoView {
  let onTouchGeometry = EventDispatcher()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
  }
}
