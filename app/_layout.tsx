import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import * as Linking from 'expo-linking'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StyleSheet } from 'react-native'
import * as Sentry from '@sentry/react-native'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { EmployeeProvider } from '../contexts/EmployeeContext'
import { initJournalPhotoSync } from '../lib/journal-photo-queue'

// Global deep-link consumer for Supabase auth redirects. Handles:
//   - email-confirmation taps (`okuji://auth?code=…&type=signup`)
//   - magic-link / password-recovery taps in the future
//   - any OAuth redirect that arrives outside the in-app browser flow
// The login screen's WebBrowser.openAuthSessionAsync path still parses
// `result.url` itself for the Google flow; this handler is for cold-
// open deep links where there's no in-app browser session to consume
// the URL.
async function handleAuthRedirect(url: string | null) {
  if (!url) return
  const parsed = Linking.parse(url)
  const params = parsed.queryParams ?? {}
  const code = params.code
  const errDesc = params.error_description
  if (typeof errDesc === 'string' && errDesc) {
    console.warn('[auth redirect] error', errDesc)
    return
  }
  if (typeof code === 'string' && code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) console.warn('[auth redirect] exchangeCodeForSession failed', error.message)
  }
}

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enableNativeFramesTracking: true,
  // Crash capture is the priority for now; performance tracing is intentionally
  // off. Flip to a non-zero sample rate when we want spans/transactions.
  tracesSampleRate: 0,
})

// Hold the native splash until we've resolved auth state.
SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    // Cold-start deep-link consumption: the user may have arrived from
    // tapping an email-confirmation link, which opens the app with the
    // URL but no in-app browser session to parse it.
    void Linking.getInitialURL().then(handleAuthRedirect)

    // Foreground deep-link consumption: same handler, fires when the
    // app is already running and a deep-link arrives.
    const sub = Linking.addEventListener('url', (e) => void handleAuthRedirect(e.url))

    return () => {
      subscription.unsubscribe()
      sub.remove()
    }
  }, [])

  // Centralized auth gate: route into the right group on auth changes.
  useEffect(() => {
    if (loading) return
    const inAuthGroup = segments[0] === '(auth)'
    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)/my-passports')
    }
  }, [session, segments, loading, router])

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync()
  }, [loading])

  // Drive the journal-photo upload queue once authenticated (idempotent).
  useEffect(() => {
    if (session) initJournalPhotoSync()
  }, [session])

  if (loading) return null // native splash stays visible

  return (
    <GestureHandlerRootView style={styles.root}>
      <EmployeeProvider>
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="passport/[id]"
            options={{ title: 'Passport', headerBackTitle: 'Back' }}
          />
          <Stack.Screen
            name="passport/stamp/[stopId]"
            options={{ title: 'Stamp', presentation: 'modal' }}
          />
          <Stack.Screen
            name="journal/[stampId]"
            options={{ title: 'Journal', presentation: 'modal' }}
          />
          {/* Passport design is web-only (okujikobo.okuji.app, desktop).
              The old mobile designer routes were removed — collectors
              design nothing in this app. */}
          <Stack.Screen name="employee" options={{ headerShown: false }} />
          <Stack.Screen name="field" options={{ headerShown: false }} />
        </Stack>
      </EmployeeProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
