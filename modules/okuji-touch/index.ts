// Feature-detected entry point. The native view is only available in a
// binary where the module was autolinked + compiled. require() is
// wrapped so importing this module never hard-fails the JS bundle — if
// the native side is absent, `OkujiTouchView` is null and callers fall
// back to a plain View + the drift-proxy tilt.
let OkujiTouchView: typeof import('./src/OkujiTouchView').OkujiTouchView | null = null

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  OkujiTouchView = require('./src/OkujiTouchView').OkujiTouchView
} catch {
  OkujiTouchView = null
}

export { OkujiTouchView }
export type {
  TouchGeometryPayload,
  OkujiTouchViewProps,
} from './src/OkujiTouchView'
