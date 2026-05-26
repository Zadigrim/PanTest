import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Surfaces a clear failure instead of a cryptic crash when the build/runtime
  // is missing config. For EAS builds these come from EAS secrets; for local
  // dev from .env (EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY).
  throw new Error(
    'Missing Supabase configuration: EXPO_PUBLIC_SUPABASE_URL and ' +
    'EXPO_PUBLIC_SUPABASE_ANON_KEY must be set (EAS secrets for builds, .env locally).',
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
