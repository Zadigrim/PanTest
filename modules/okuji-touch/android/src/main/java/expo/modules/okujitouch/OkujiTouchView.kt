package expo.modules.okujitouch

import android.content.Context
import android.view.MotionEvent
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

// Non-intrusive contact-ellipse observer.
//
// We override dispatchTouchEvent to READ the MotionEvent's contact
// geometry, then immediately call super so the touch continues down to
// the React children (the PanResponder running the stamp gesture). We
// never consume the event — this view only listens.
//
// Geometry → tilt:
//   getTouchMajor / getTouchMinor — the contact ellipse axes. A flat
//     fingertip press is near-circular (major ≈ minor); rocking the
//     finger elongates it (major > minor). eccentricity = 1 - minor/major
//     is the tilt AMOUNT.
//   getOrientation — angle of the MAJOR axis (radians, 0 = pointing up,
//     positive clockwise). That axis is the rock/tilt axis; we emit it as
//     a unit vector. The axis is undirected (two ends), so the JS side
//     resolves which end is the pressed/darker edge using the finger's
//     net drift.
class OkujiTouchView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val onTouchGeometry by EventDispatcher()

  override fun dispatchTouchEvent(event: MotionEvent): Boolean {
    try {
      emitGeometry(event)
    } catch (_: Throwable) {
      // Never let a geometry read interfere with touch delivery.
    }
    return super.dispatchTouchEvent(event)
  }

  private fun emitGeometry(event: MotionEvent) {
    val phase = when (event.actionMasked) {
      MotionEvent.ACTION_DOWN, MotionEvent.ACTION_POINTER_DOWN -> "began"
      MotionEvent.ACTION_MOVE -> "moved"
      MotionEvent.ACTION_UP, MotionEvent.ACTION_POINTER_UP, MotionEvent.ACTION_CANCEL -> "ended"
      else -> return
    }

    val index = 0 // primary pointer; stamping is single-finger
    val major = event.getTouchMajor(index)
    val minor = event.getTouchMinor(index)

    if (major <= 0f) {
      onTouchGeometry(mapOf("phase" to phase, "dx" to 0.0, "dy" to 0.0, "intensity" to 0.0))
      return
    }

    val orientation = event.getOrientation(index).toDouble() // -PI/2..PI/2
    // Unit vector along the major (tilt) axis. orientation 0 = up.
    val ux = Math.sin(orientation)
    val uy = -Math.cos(orientation)

    val ratio = (minor / major).toDouble().coerceIn(0.0, 1.0)
    val intensity = (1.0 - ratio).coerceIn(0.0, 1.0)

    onTouchGeometry(
      mapOf(
        "phase" to phase,
        "dx" to ux,
        "dy" to uy,
        "intensity" to intensity,
      ),
    )
  }
}
