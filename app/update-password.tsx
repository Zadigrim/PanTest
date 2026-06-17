import React, { useEffect, useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  KeyboardAvoidingView, Platform, ImageBackground,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { supabase } from '../lib/supabase'
import { recoveryFlag } from '../lib/recovery-flag'
import { palette } from '../lib/colors'

/**
 * Set-new-password screen for the password-recovery deep link.
 *
 * Reached from app/_layout.tsx's deep-link handler after
 * okuji://auth?flow=recovery&code=… is exchanged for a (recovery) session.
 * The recoveryFlag is up while we're here so the auth gate leaves us put.
 * On success we updateUser the new password, clear the flag, and route into
 * the signed-in app. If there's no session (opened out of context), we bail
 * back to login.
 */
export default function UpdatePasswordScreen() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  // No recovery session ⇒ this screen was opened out of context. Clear the
  // flag and send the user to login rather than stranding them.
  useEffect(() => {
    let cancelled = false
    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      if (!data.session) {
        recoveryFlag.set(false)
        router.replace('/(auth)/login')
      }
    })
    return () => { cancelled = true }
  }, [])

  const handleUpdate = async () => {
    if (password.length < 8) { Alert.alert('Use at least 8 characters.'); return }
    if (password !== confirm) { Alert.alert('Passwords don’t match.'); return }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      Alert.alert('Couldn’t update password', error.message)
      return
    }
    // Recovery complete — release the gate and enter the app.
    recoveryFlag.set(false)
    router.replace('/(tabs)/my-passports')
  }

  return (
    <ImageBackground
      source={require('../assets/brand/okuji-bg.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.inner}>
          <Text style={styles.heading}>Choose a new password</Text>

          <View style={styles.passwordRow}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              placeholder="New password"
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

          <TextInput
            style={styles.input}
            placeholder="Confirm new password"
            placeholderTextColor="#aaa"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!showPassword}
            editable={!loading}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleUpdate}
            disabled={loading}
          >
            <Text style={styles.btnText}>{loading ? 'Updating…' : 'Set new password'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { recoveryFlag.set(false); router.replace('/(auth)/login') }}
            style={styles.link}
          >
            <Text style={styles.linkText}>← Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </ImageBackground>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.navy },
  flex: { flex: 1 },
  inner: { flex: 1, justifyContent: 'center', padding: 32, paddingTop: 140 },
  heading: {
    color: palette.cream, fontSize: 20, fontWeight: '700', marginBottom: 16, textAlign: 'center',
  },
  input: {
    borderWidth: 1, borderColor: 'rgba(244,236,216,0.22)', borderRadius: 10,
    padding: 14, color: palette.cream, backgroundColor: 'rgba(31,29,26,0.4)',
    fontSize: 15, marginBottom: 12,
  },
  passwordRow: { position: 'relative', justifyContent: 'center' },
  passwordInput: { paddingRight: 48 },
  eyeBtn: {
    position: 'absolute', right: 6, top: 0, bottom: 12, width: 40,
    alignItems: 'center', justifyContent: 'center',
  },
  btn: {
    backgroundColor: palette.green, borderRadius: 10, padding: 16,
    alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  link: { marginTop: 20, alignItems: 'center' },
  linkText: { color: palette.accent, fontSize: 13 },
})
