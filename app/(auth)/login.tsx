import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform,
  ImageBackground, useWindowDimensions,
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

  // Wide screens (tablet, landscape) get the branded split layout — wordmark
  // baked into the art on the left, form card on the right (design mock).
  // Phones keep the existing centered layout below. 820 is the sm/tablet
  // threshold; phones (even large, landscape) stay under it in portrait.
  const { width } = useWindowDimensions()
  const wide = width >= 820

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

  // ── Tablet / wide layout ──────────────────────────────────────────────────
  // The background art carries the topographic field + okuji wordmark +
  // tagline on the LEFT (form area left empty in the art); this recreates the
  // form card that sits on the right. Same state + handlers as the phone form.
  if (wide) {
    return (
      <ImageBackground
        source={require('../../assets/brand/okuji-login-tablet-bg-2560x1600.png')}
        style={styles.container}
        resizeMode="cover"
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={t.stage}>
            <View style={t.card}>
              <Text style={t.label}>Email</Text>
              <TextInput
                style={t.input}
                placeholder="you@example.com"
                placeholderTextColor="rgba(245,240,232,0.4)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />

              <Text style={[t.label, { marginTop: 18 }]}>Password</Text>
              <View style={t.passwordRow}>
                <TextInput
                  style={[t.input, { flex: 1, marginBottom: 0, paddingRight: 60 }]}
                  placeholder="••••••••"
                  placeholderTextColor="rgba(245,240,232,0.4)"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={t.showBtn}
                  onPress={() => setShowPassword((v) => !v)}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                >
                  <Text style={t.showText}>{showPassword ? 'Hide' : 'Show'}</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={handleForgotPassword}
                disabled={loading}
                style={t.forgot}
              >
                <Text style={t.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[t.signInBtn, loading && styles.btnDisabled]}
                onPress={handleLogin}
                disabled={loading}
              >
                <Text style={t.signInText}>{loading ? 'Signing in…' : 'Sign in'}</Text>
              </TouchableOpacity>

              <View style={t.dividerRow}>
                <View style={t.divider} />
                <Text style={t.dividerText}>OR</Text>
                <View style={t.divider} />
              </View>

              <TouchableOpacity
                style={[t.googleBtn, loading && styles.btnDisabled]}
                onPress={handleGoogleLogin}
                disabled={loading}
              >
                <Ionicons name="logo-google" size={18} color={palette.ink} style={{ marginRight: 10 }} />
                <Text style={t.googleText}>Continue with Google</Text>
              </TouchableOpacity>

              <View style={t.footerRow}>
                <Text style={t.footerText}>New to okuji? </Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/register')} disabled={loading}>
                  <Text style={t.footerLink}>Create an account</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </ImageBackground>
    )
  }

  // ── Phone / default layout (unchanged) ────────────────────────────────────
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

// Tablet / wide split-layout form card (design mock). The card floats on the
// right over the branded art; sizing is capped so it stays a tidy panel on
// very wide screens.
const t = StyleSheet.create({
  // Push the card to the right, vertically centered, with a comfortable
  // right margin. On a landscape tablet this lands the card in the mock's
  // right third while the wordmark art breathes on the left.
  stage: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: '6%',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    padding: 28,
    borderRadius: 16,
    backgroundColor: 'rgba(18,46,35,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(245,240,232,0.18)',
  },
  label: {
    color: 'rgba(245,240,232,0.7)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(245,240,232,0.22)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    color: palette.cream,
    backgroundColor: 'rgba(15,33,26,0.5)',
    fontSize: 15,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  showBtn: {
    position: 'absolute',
    right: 14,
    paddingVertical: 6,
    paddingLeft: 10,
  },
  showText: {
    color: 'rgba(245,240,232,0.75)',
    fontSize: 13,
    fontWeight: '600',
  },
  forgot: {
    alignSelf: 'flex-end',
    marginTop: 10,
  },
  forgotText: {
    color: 'rgba(245,240,232,0.85)',
    fontSize: 13,
  },
  signInBtn: {
    backgroundColor: palette.accent,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 18,
  },
  signInText: {
    color: palette.ink,
    fontWeight: '700',
    fontSize: 16,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(245,240,232,0.2)',
  },
  dividerText: {
    color: 'rgba(245,240,232,0.6)',
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginHorizontal: 12,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.cream,
    borderRadius: 10,
    paddingVertical: 14,
  },
  googleText: {
    color: palette.ink,
    fontWeight: '700',
    fontSize: 15,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 18,
  },
  footerText: {
    color: 'rgba(245,240,232,0.75)',
    fontSize: 14,
  },
  footerLink: {
    color: palette.accent,
    fontSize: 14,
    fontWeight: '700',
  },
})
