import { useEffect, useState } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StyleSheet } from 'react-native'
import * as Sentry from '@sentry/react-native'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { EmployeeProvider } from '../contexts/EmployeeContext'
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

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => subscription.unsubscribe()
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
          <Stack.Screen
            name="designer/index"
            options={{ title: 'Passport Designer' }}
          />
          <Stack.Screen
            name="designer/[id]"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="designer/page/[pageId]"
            options={{ title: 'Edit Section' }}
          />
          <Stack.Screen
            name="designer/stop/[stopId]"
            options={{ title: 'Edit Stop' }}
          />
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
