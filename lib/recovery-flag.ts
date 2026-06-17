// Synchronous module-level flag for an in-progress password recovery.
//
// A recovery deep link (okuji://auth?flow=recovery&code=…) exchanges the
// code for a session — which would normally trip the auth gate in
// app/_layout.tsx (`session && inAuthGroup → go to tabs`) and bounce the
// user past the set-new-password screen. The deep-link handler sets this
// flag BEFORE the exchange so the gate skips its auto-routing until the
// update-password screen finishes (or the flow is abandoned).
//
// It's a plain module variable, not React state, on purpose: the auth-gate
// effect reads it synchronously when the session change fires, so there's
// no render-timing race.

let recovering = false

export const recoveryFlag = {
  set(value: boolean) { recovering = value },
  get() { return recovering },
}
