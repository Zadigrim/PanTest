import { useCallback, useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import * as Linking from 'expo-linking'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StyleSheet } from 'react-native'
import * as Sentry from '@sentry/react-native'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { recoveryFlag } from '../lib/recovery-flag'
import { EmployeeProvider } from '../contexts/EmployeeContext'
import { DemoProvider } from '../contexts/DemoContext'
import { initJournalPhotoSync } from '../lib/journal-photo-queue'

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

  // Global deep-link consumer for Supabase auth redirects:
  //   - email-confirmation taps (`okuji://auth?code=…`)
  //   - password recovery (`okuji://auth?flow=recovery&code=…`)
  //   - any OAuth redirect that arrives outside the in-app browser flow
  // (The login screen's WebBrowser flow parses its own result.url for Google;
  // this is for cold-open / foreground deep links.)
  //
  // Recovery vs confirmation can't be told apart from the event alone here
  // (the mobile client has detectSessionInUrl:false and we exchange the code
  // manually), so we distinguish by the `flow=recovery` marker we put on the
  // frozen okuji:// redirect at initiation. On recovery we raise the
  // recoveryFlag BEFORE exchanging so the auth gate doesn't bounce the user to
  // the tabs, then route to the set-new-password screen.
  const onDeepLink = useCallback(async (url: string | null) => {
    if (!url) return
    const parsed = Linking.parse(url)
    const params = parsed.queryParams ?? {}
    const errDesc = params.error_description
    if (typeof errDesc === 'string' && errDesc) {
      console.warn('[auth redirect] error', errDesc)
      return
    }
    const code = typeof params.code === 'string' ? params.code : null
    if (!code) return
    const isRecovery = params.flow === 'recovery'
    if (isRecovery) recoveryFlag.set(true)
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      if (isRecovery) recoveryFlag.set(false)
      console.warn('[auth redirect] exchangeCodeForSession failed', error.message)
      return
    }
    if (isRecovery) router.replace('/update-password')
  }, [router])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    // Cold-start deep-link consumption: the user may have arrived by tapping
    // an email link, which opens the app with the URL but no in-app browser
    // session to parse it.
    void Linking.getInitialURL().then(onDeepLink)

    // Foreground deep-link consumption: same handler, fires when the app is
    // already running and a deep-link arrives.
    const sub = Linking.addEventListener('url', (e) => void onDeepLink(e.url))

    return () => {
      subscription.unsubscribe()
      sub.remove()
    }
  }, [onDeepLink])

  // Centralized auth gate: route into the right group on auth changes.
  useEffect(() => {
    if (loading) return
    // During password recovery the user holds a (recovery) session but must
    // stay on the update-password screen — don't auto-route them to the tabs.
    if (recoveryFlag.get()) return
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
        <DemoProvider>
        <Stack>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/* Password-recovery landing — top-level (NOT in (auth)) so the
              recovery session doesn't trip the auth gate's group routing. */}
          <Stack.Screen name="update-password" options={{ headerShown: false }} />
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
          <Stack.Screen
            name="stop/[stopId]"
            options={{ title: 'Reviews', headerBackTitle: 'Back' }}
          />
          {/* Passport design is web-only (okujikobo.okuji.app, desktop).
              The old mobile designer routes were removed — collectors
              design nothing in this app. */}
          <Stack.Screen name="employee" options={{ headerShown: false }} />
          <Stack.Screen name="field" options={{ headerShown: false }} />
        </Stack>
        </DemoProvider>
      </EmployeeProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
