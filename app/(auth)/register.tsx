import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform,
  ImageBackground,
} from 'react-native'
import { router } from 'expo-router'
import { makeRedirectUri } from 'expo-auth-session'
import { supabase } from '../../lib/supabase'
import { palette } from '../../lib/colors'

// Email-confirmation links from Supabase redirect to this deep link.
// The existing login screen already parses ?code=... from okuji://auth
// and calls exchangeCodeForSession, so the confirmed user lands
// signed-in once they open the email on this device. The Supabase
// dashboard redirect allow-list must include the resolved URL.
const REDIRECT_TO = makeRedirectUri({ scheme: 'okuji', path: 'auth' })

export default function RegisterScreen() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  // After a successful signUp where Supabase didn't return a session
  // (email-confirmation is on), we show a "check your email" pane and
  // a Resend button rather than dropping the user into the tabs.
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<string | null>(null)
  const [resending, setResending] = useState(false)

  const handleRegister = async () => {
    if (!displayName || !email || !password) {
      Alert.alert('Please fill in all fields.')
      return
    }
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
        emailRedirectTo: REDIRECT_TO,
      },
    })
    if (error || !data.user) {
      setLoading(false)
      Alert.alert('Registration failed', error?.message ?? 'Unknown error')
      return
    }

    // The handle_new_user trigger creates the profile row; the
    // client-side insert here was a safety net from before that trigger
    // landed. Keep it for self-heal: an UPSERT so it doesn't error if
    // the trigger beat us to it.
    await supabase.from('profiles').upsert(
      {
        id: data.user.id,
        display_name: displayName,
        role: 'collector',
      },
      { onConflict: 'id' },
    )

    setLoading(false)

    if (!data.session) {
      // Email confirmation required — Supabase withheld the session.
      setAwaitingConfirmation(email)
      return
    }

    // Confirmation off (legacy or future), session present → straight in.
    router.replace('/(tabs)/my-passports')
  }

  const handleResend = async () => {
    if (!awaitingConfirmation) return
    setResending(true)
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: awaitingConfirmation,
      options: { emailRedirectTo: REDIRECT_TO },
    })
    setResending(false)
    if (error) {
      Alert.alert('Couldn’t resend', error.message)
    } else {
      Alert.alert('Sent', 'Check your inbox for a new verification link.')
    }
  }

  if (awaitingConfirmation) {
    return (
      <ImageBackground
        source={require('../../assets/brand/okuji-bg.png')}
        style={styles.container}
        resizeMode="cover"
      >
        <View style={styles.inner}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.body}>
            We sent a verification link to <Text style={styles.email}>{awaitingConfirmation}</Text>. Open it on this
            device to finish creating your account.
          </Text>
          <TouchableOpacity
            style={[styles.btn, resending && styles.btnDisabled]}
            onPress={handleResend}
            disabled={resending}
          >
            <Text style={styles.btnText}>{resending ? 'Sending…' : 'Resend verification email'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.link}>
            <Text style={styles.linkText}>← Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </ImageBackground>
    )
  }

  return (
    // Same brand background as login (crest/wordmark baked into the art —
    // no logo element of its own; see login.tsx).
    <ImageBackground
      source={require('../../assets/brand/okuji-bg.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.inner}>
        <Text style={styles.title}>Create account</Text>

        <TextInput
          style={styles.input}
          placeholder="Your name"
          placeholderTextColor="#aaa"
          value={displayName}
          onChangeText={setDisplayName}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#aaa"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#aaa"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          <Text style={styles.btnText}>{loading ? 'Creating account…' : 'Create account'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.back()} style={styles.link}>
          <Text style={styles.linkText}>Already have an account? Sign in</Text>
        </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  // Forest field comes from the background art; navy fallback only if
  // the asset fails to load.
  container: { flex: 1, backgroundColor: palette.navy },
  flex: { flex: 1 },
  // paddingTop biases the form below the baked brand block (see login).
  inner: { flex: 1, justifyContent: 'center', padding: 32, paddingTop: 140 },
  title: {
    fontSize: 26, fontWeight: '700', color: palette.cream,
    textAlign: 'center', fontFamily: 'serif', letterSpacing: 1, marginBottom: 32,
  },
  // Ink-translucent fields over the forest field (matches login).
  input: {
    borderWidth: 1, borderColor: 'rgba(244,236,216,0.22)', borderRadius: 10,
    padding: 14, color: palette.cream, backgroundColor: 'rgba(31,29,26,0.4)',
    fontSize: 15, marginBottom: 12,
  },
  btn: {
    backgroundColor: palette.green, borderRadius: 10, padding: 16,
    alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  link: { marginTop: 20, alignItems: 'center' },
  linkText: { color: palette.accent, fontSize: 13 },
  body: {
    color: palette.cream, fontSize: 14, lineHeight: 20,
    textAlign: 'center', marginBottom: 24,
  },
  email: { fontWeight: '700' },
})
