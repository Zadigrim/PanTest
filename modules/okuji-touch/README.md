# okuji-touch

Local Expo module that reads fingertip **contact-ellipse geometry** for the
stamp **tilt** mechanic, without consuming the touch.

- **Android** — real read. `MotionEvent.getTouchMajor/getTouchMinor/getOrientation`
  give the contact ellipse; eccentricity → tilt amount, major-axis orientation
  → tilt direction. Read inside `dispatchTouchEvent`, then `super` is called so
  the React `PanResponder` underneath runs unchanged.
- **iOS** — deliberate **no-op**. `UITouch` exposes `majorRadius` (size) but no
  finger contact *orientation* (azimuth/altitude are Apple Pencil only), so
  directional tilt can't be measured. The view hosts its children and emits
  nothing; JS falls back to the drift-direction proxy.

## Posture change (read me)

The stamp gesture was historically a **JS-proxy-only** design, and that was a
deliberate patent posture (`StampGestureInteraction.tsx` previously stated true
contact-ellipse reads were "Path A, deferred by design"). This module
**activates Path A on Android** — an intentional change approved by Nathan. If
that posture matters for an IP filing, this is the line that crossed it.

## Why this is on its own branch

This native code **could not be compiled or autolinked-tested** in the
environment that wrote it. A malformed native module fails the *entire* EAS
build, so it lives on `claude/stamp-tilt-native`, separate from the proven
proxy version on the default branch. The JS integration is **feature-detected**:
if the native module isn't in the binary, `OkujiTouchView` is `null`, the
gesture renders a plain `View`, and tilt uses the proxy — so nothing here can
break stamping at runtime. The only risk is the **build** itself.

## If the EAS build fails to configure this module

The Kotlin/Swift logic is correct; the fragile part is the SDK-version-specific
build glue (`android/build.gradle`, `ios/OkujiTouch.podspec`, autolinking).
Regenerate that glue against your exact Expo SDK and drop the logic back in:

```bash
# from the repo root, on this branch
npx create-expo-module@latest --local okuji-touch-scaffold
# then copy these into the generated module, keeping the generated
# build.gradle / podspec / expo-module.config.json:
#   android/src/main/java/expo/modules/okujitouch/OkujiTouchView.kt
#   android/src/main/java/expo/modules/okujitouch/OkujiTouchModule.kt
#   ios/OkujiTouchView.swift
#   ios/OkujiTouchModule.swift
#   src/OkujiTouchView.tsx
# rename the scaffold dir to okuji-touch, rebuild.
```

A local module is autolinked by EAS managed builds (no committed
`android/`/`ios/` app dirs, no `app.json`/`eas.json` edits, no `prebuild`).

## Files

| File | Role |
| --- | --- |
| `expo-module.config.json` | registers `OkujiTouchModule` on both platforms |
| `index.ts` | feature-detected JS entry (`OkujiTouchView` or `null`) |
| `src/OkujiTouchView.tsx` | native view wrapper + `onTouchGeometry` typing |
| `android/.../OkujiTouchView.kt` | the contact-ellipse read (the real logic) |
| `android/.../OkujiTouchModule.kt` | module + view registration |
| `ios/OkujiTouchView.swift` | no-op passthrough (iOS proxy) |
| `ios/OkujiTouchModule.swift` | module + view registration |

## Event shape

`onTouchGeometry` → `{ phase, dx, dy, intensity }`:
- `phase`: `"began" | "moved" | "ended"`
- `dx, dy`: unit vector along the contact major (tilt) axis, view-local. The
  axis is undirected; `StampGestureInteraction` flips it to the end the finger
  is leaning toward using net drift.
- `intensity`: `1 - minor/major`, the ellipse eccentricity (0 = flat circular
  press, →1 = strong rock).
