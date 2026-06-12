// Demo-mode context — authorization + toggle state for the contained
// demo mode (platform admins and admin-flagged reviewer accounts).
//
// SECURITY MODEL: this context only decides what the UI *shows*. Every
// bypass it enables (free acquisition, unverified stamping) is
// re-authorized server-side — verify-stamp confirms is_demo_authorized()
// under the caller's JWT before accepting an unverified stamp, and
// ensure_collector_passport does the same before a free acquire of a
// paid passport (migration 026). A tampered client that flips this
// toggle without authorization gets 403s, not stamps.
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '../lib/supabase'

const DEMO_MODE_KEY = '@okuji/demo_mode'

interface DemoContextValue {
  // Server-confirmed: is_platform_admin() OR profiles.demo_mode_enabled.
  demoAuthorized: boolean
  // The user's local toggle (persisted). Meaningless without authorization.
  demoMode: boolean
  // The only flag consumers should branch on: authorized AND toggled on.
  demoActive: boolean
  setDemoMode: (v: boolean) => void
}

const DemoContext = createContext<DemoContextValue>({
  demoAuthorized: false,
  demoMode: false,
  demoActive: false,
  setDemoMode: () => {},
})

export function useDemoContext() {
  return useContext(DemoContext)
}

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [demoAuthorized, setDemoAuthorized] = useState(false)
  const [demoMode, setDemoModeState] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Load persisted toggle on mount
  useEffect(() => {
    AsyncStorage.getItem(DEMO_MODE_KEY).then((val) => {
      if (val === 'true') setDemoModeState(true)
      setHydrated(true)
    })
  }, [])

  // Resolve authorization on auth changes via the single server gate.
  useEffect(() => {
    async function resolveAuthorization() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any).rpc('is_demo_authorized')
      setDemoAuthorized(data === true)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) resolveAuthorization()
      else {
        setDemoAuthorized(false)
        setDemoModeState(false)
      }
    })

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) resolveAuthorization()
    })

    return () => subscription.unsubscribe()
  }, [])

  const setDemoMode = useCallback((v: boolean) => {
    setDemoModeState(v)
    AsyncStorage.setItem(DEMO_MODE_KEY, v ? 'true' : 'false')
  }, [])

  const value: DemoContextValue = {
    demoAuthorized,
    demoMode: hydrated ? demoMode : false,
    demoActive: demoAuthorized && hydrated && demoMode,
    setDemoMode,
  }

  return (
    <DemoContext.Provider value={value}>
      {children}
    </DemoContext.Provider>
  )
}
