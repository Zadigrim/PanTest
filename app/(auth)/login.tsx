import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform,
  ImageBackground,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { makeRedirectUri } from 'expo-auth-session'
import * as WebBrowser from 'expo-web-browser'
import { supabase } from '../../lib/supabase'
import { palette } from '../../lib/colors'

WebBrowser.maybeCompleteAuthSession()

// Returns to the app via the okuji:// deep link (registered in standalone builds).
const redirectTo = makeRedirectUri({ scheme: 'okuji', path: 'auth' })

function paramsFromUrl(url: string): Record<string, string> {
  const out: Record<string, string> = {}
  const query = url.split('?')[1]?.split('#')[0]
  const hash = url.includes('#') ? url.split('#')[1] : ''
  for (const part of [query, hash]) {
    if (!part) continue
    for (const kv of part.split('&')) {
      const [k, v] = kv.split('=')
      if (k) out[decodeURIComponent(k)] = decodeURIComponent(v ?? '')
    }
  }
  return out
}

async function completeOAuth(url: string) {
  const { access_token, refresh_token, code, error_description } = paramsFromUrl(url)
  if (error_description) throw new Error(error_description)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) throw error
    return
  }
  if (access_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token })
    if (error) throw error
  }
}

export default function LoginScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    if (!email || !password) { Alert.alert('Please enter email and password.'); return }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      const isUnverified =
        (error as { code?: string }).code === 'email_not_confirmed' ||
        /email.*not.*confirm/i.test(error.message)
      if (isUnverified) {
        Alert.alert(
          'Verify your email',
          `${email} hasn’t been verified yet. Check your inbox for the verification link, or resend it now.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Resend',
              onPress: async () => {
                const { error: resendErr } = await supabase.auth.resend({
                  type: 'signup',
                  email,
                  options: { emailRedirectTo: redirectTo },
                })
                Alert.alert(
                  resendErr ? 'Couldn’t resend' : 'Sent',
                  resendErr ? resendErr.message : 'Check your inbox for a fresh verification link.',
                )
              },
            },
          ],
        )
      } else {
        Alert.alert('Login failed', error.message)
      }
      return
    }
    router.replace('/(tabs)/my-passports')
  }

  // Password recovery. Reuses the FROZEN okuji:// deep link with a
  // `flow=recovery` marker (Supabase appends &code=…); app/_layout.tsx's
  // handler routes that to the update-password screen. Anti-enumeration:
  // the result is ignored and the confirmation is identical whether or not
  // the address is registered.
  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Enter your email', 'Type your account email above, then tap “Forgot password?” again.')
      return
    }
    setLoading(true)
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${redirectTo}?flow=recovery` })
    setLoading(false)
    Alert.alert('Check your email', 'If an account exists for that email, we’ve sent a reset link.')
  }

  // Requires the Google provider enabled in Supabase Auth, the okuji:// redirect
  // allow-listed, and a Google OAuth client configured for this build's signing
  // cert (deferred external setup). Until then this surfaces the error gracefully
  // rather than crashing.
  const handleGoogleLogin = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true },
      })
      if (error) throw error
      if (!data?.url) throw new Error('Could not start Google sign-in.')
      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
      if (result.type === 'success') {
        await completeOAuth(result.url)
        router.replace('/(tabs)/my-passports')
      }
    } catch (e) {
      Alert.alert('Google sign-in', e instanceof Error ? e.message : 'Sign-in failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    // Brand background (assets/brand/okuji-bg*.png density triplet — RN
    // picks per device). Crest, wordmark, and tagline are baked into the
    // art, so the screen renders no logo/title of its own; the form sits
    // in the clear band beneath the brand block.
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
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#aaa"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!loading}
        />
        {/* Password with show/hide toggle. NOTE: a login restyle (design
            mock) is incoming — carry this eye toggle into the new screen. */}
        <View style={styles.passwordRow}>
          <TextInput
            style={[styles.input, styles.passwordInput]}
            placeholder="Password"
            placeholderTextColor="#aaa"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            editable={!loading}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setShowPassword((v) => !v)}
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
          >
            <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#aaa" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.btnText}>{loading ? 'Signing in…' : 'Sign in'}</Text>
        </TouchableOpacity>

        <View style={styles.dividerRow}>
          <View style={styles.divider} />
          <Text style={styles.dividerText}>or continue with</Text>
          <View style={styles.divider} />
        </View>

        <TouchableOpacity
          style={[styles.googleBtn, loading && styles.btnDisabled]}
          onPress={handleGoogleLogin}
          disabled={loading}
        >
          <Text style={styles.googleBtnText}>Continue with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleForgotPassword} disabled={loading} style={styles.link}>
          <Text style={styles.linkText}>Forgot password?</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push('/(auth)/register')} style={styles.linkTight}>
          <Text style={styles.linkText}>Don't have an account? Register</Text>
        </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  // Forest field comes from the background art; navy fallback shows only
  // if the asset somehow fails to load.
  container: { flex: 1, backgroundColor: palette.navy },
  flex: { flex: 1 },
  // paddingTop biases the centered form downward so it clears the baked
  // wordmark + tagline block in the art's upper third.
  inner: { flex: 1, justifyContent: 'center', padding: 32, paddingTop: 140 },
  // Ink-translucent fields over the forest field (okuji palette: ink
  // #1f1d1a, cream hairline) — the old navy boxes clashed with the art.
  input: {
    borderWidth: 1, borderColor: 'rgba(244,236,216,0.22)', borderRadius: 10,
    padding: 14, color: palette.cream, backgroundColor: 'rgba(31,29,26,0.4)',
    fontSize: 15, marginBottom: 12,
  },
  passwordRow: {
    position: 'relative',
    justifyContent: 'center',
  },
  passwordInput: {
    paddingRight: 48,
  },
  eyeBtn: {
    position: 'absolute',
    right: 6,
    top: 0,
    bottom: 12,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn: {
    backgroundColor: palette.green, borderRadius: 10, padding: 16,
    alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 4 },
  divider: { flex: 1, height: 1, backgroundColor: 'rgba(244,236,216,0.22)' },
  dividerText: { color: 'rgba(244,236,216,0.6)', fontSize: 12, marginHorizontal: 10 },
  googleBtn: {
    backgroundColor: palette.cream, borderRadius: 10, padding: 16,
    alignItems: 'center', marginTop: 12,
  },
  googleBtnText: { color: palette.navy, fontWeight: '700', fontSize: 15 },
  link: { marginTop: 20, alignItems: 'center' },
  linkTight: { marginTop: 10, alignItems: 'center' },
  linkText: { color: palette.accent, fontSize: 13 },
})
