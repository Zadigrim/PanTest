import React, { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '../../lib/supabase'

export default function RegisterScreen() {
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleRegister = async () => {
    if (!displayName || !email || !password) {
      Alert.alert('Please fill in all fields.')
      return
    }
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error || !data.user) {
      setLoading(false)
      Alert.alert('Registration failed', error?.message ?? 'Unknown error')
      return
    }

    await supabase.from('profiles').insert({
      id: data.user.id,
      display_name: displayName,
      role: 'collector',
    })

    setLoading(false)
    Alert.alert('Welcome!', 'Your account has been created.', [
      { text: 'Continue', onPress: () => router.replace('/(tabs)/') },
    ])
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.logo}>🧭</Text>
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
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D1B2A' },
  inner: { flex: 1, justifyContent: 'center', padding: 32 },
  logo: { fontSize: 48, textAlign: 'center', marginBottom: 8 },
  title: {
    fontSize: 26, fontWeight: '700', color: '#F5F0E8',
    textAlign: 'center', fontFamily: 'serif', letterSpacing: 1, marginBottom: 32,
  },
  input: {
    borderWidth: 1, borderColor: '#2a3d52', borderRadius: 10,
    padding: 14, color: '#F5F0E8', backgroundColor: '#152232',
    fontSize: 15, marginBottom: 12,
  },
  btn: {
    backgroundColor: '#1D9E75', borderRadius: 10, padding: 16,
    alignItems: 'center', marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  link: { marginTop: 20, alignItems: 'center' },
  linkText: { color: '#C9A84C', fontSize: 13 },
})
