import { useEffect } from 'react'
import { Stack } from 'expo-router'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { StyleSheet } from 'react-native'
import * as Sentry from '@sentry/react-native'
import { supabase } from '../lib/supabase'

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  enableNativeFramesTracking: true,
})

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
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
          name="designer/[passportId]"
          options={{ title: 'Edit Passport' }}
        />
        <Stack.Screen name="employee" options={{ headerShown: false }} />
      </Stack>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
