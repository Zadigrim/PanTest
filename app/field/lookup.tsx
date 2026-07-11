// Collector lookup — find collector by userId (from QR) or manual 6-char code.
import React, { useState, useEffect, useCallback } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert, useWindowDimensions,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase, getCurrentUser } from '../../lib/supabase'
import { palette } from '../../lib/colors'

interface CollectorInfo {
  firstName: string
  passportTitle: string
  stopName: string
  stampId: string
  userId: string
}

export default function LookupScreen() {
  const { stopId, userId: scannedUserId } = useLocalSearchParams<{
    stopId: string
    userId?: string
  }>()

  const [codeInput, setCodeInput] = useState('')
  const [loading, setLoading] = useState(!!scannedUserId)
  const [submitting, setSubmitting] = useState(false)
  const [collector, setCollector] = useState<CollectorInfo | null>(null)
  const [alreadyAcknowledged, setAlreadyAcknowledged] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const lookupByUserId = useCallback(async (uid: string) => {
    setLoading(true)
    setNotFound(false)
    setCollector(null)

    // Find pending stamp for this user + stop
    const { data: stampData } = await supabase
      .from('stamps')
      .select(`
        id,
        user_id,
        stop_id,
        status,
        stops (
          name,
          passport_pages (
            passports (title)
          )
        ),
        profiles (display_name)
      `)
      .eq('user_id', uid)
      .eq('stop_id', stopId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!stampData) {
      setNotFound(true)
      setLoading(false)
      return
    }

    const stamp = stampData as any
    const stopInfo = stamp.stops
    const passport = stopInfo?.passport_pages?.passports
    const profile = stamp.profiles

    const firstName = (profile?.display_name ?? 'Visitor').split(' ')[0]
    const passportTitle = passport?.title ?? 'Unknown Passport'
    const stopName = stopInfo?.name ?? 'Unknown Stop'

    // Check for presence_session today
    const todayMidnight = new Date()
    todayMidnight.setHours(0, 0, 0, 0)

    const { data: existing } = await supabase
      .from('presence_sessions')
      .select('id')
      .eq('user_id', uid)
      .eq('stop_id', stopId)
      .gte('created_at', todayMidnight.toISOString())
      .maybeSingle()

    setAlreadyAcknowledged(!!existing)
    setCollector({
      firstName,
      passportTitle,
      stopName,
      stampId: stamp.id,
      userId: uid,
    })
    setLoading(false)
  }, [stopId])

  const lookupByCode = useCallback(async (code: string) => {
    setSubmitting(true)
    setNotFound(false)
    setCollector(null)

    // 6-char code = first 6 chars of user_id (uppercased)
    // Find pending stamp where user_id starts with that prefix and stop_id matches
    const prefix = code.toLowerCase()

    const { data: stamps } = await supabase
      .from('stamps')
      .select(`
        id,
        user_id,
        stop_id,
        status,
        stops (
          name,
          passport_pages (
            passports (title)
          )
        ),
        profiles (display_name)
      `)
      .eq('stop_id', stopId)
      .order('created_at', { ascending: false })
      .limit(50)

    const match = (stamps ?? []).find((s: any) =>
      s.user_id?.toLowerCase().startsWith(prefix)
    ) as any

    if (!match) {
      setNotFound(true)
      setSubmitting(false)
      return
    }

    const stopInfo = match.stops
    const passport = stopInfo?.passport_pages?.passports
    const profile = match.profiles

    const firstName = (profile?.display_name ?? 'Visitor').split(' ')[0]
    const passportTitle = passport?.title ?? 'Unknown Passport'
    const stopName = stopInfo?.name ?? 'Unknown Stop'

    const todayMidnight = new Date()
    todayMidnight.setHours(0, 0, 0, 0)

    const { data: existing } = await supabase
      .from('presence_sessions')
      .select('id')
      .eq('user_id', match.user_id)
      .eq('stop_id', stopId)
      .gte('created_at', todayMidnight.toISOString())
      .maybeSingle()

    setAlreadyAcknowledged(!!existing)
    setCollector({
      firstName,
      passportTitle,
      stopName,
      stampId: match.id,
      userId: match.user_id,
    })
    setSubmitting(false)
  }, [stopId])

  useEffect(() => {
    if (scannedUserId) lookupByUserId(scannedUserId)
  }, [scannedUserId, lookupByUserId])

  const handleCodeSubmit = () => {
    const trimmed = codeInput.trim().toUpperCase()
    if (trimmed.length < 4) {
      Alert.alert('Code too short', 'Enter at least 4 characters.')
      return
    }
    lookupByCode(trimmed)
  }

  const handleAcknowledge = () => {
    if (!collector) return
    router.push({
      pathname: '/field/acknowledge',
      params: {
        stampId: collector.stampId,
        userId: collector.userId,
        stopId,
      },
    })
  }

  const { width } = useWindowDimensions()
  // Landscape counter tablets get a two-pane workspace; phones (and portrait
  // tablets) keep the single-column flow below, unchanged.
  const wide = width >= 700

  // Narrow keeps its full-screen loading state. In wide mode the spinner lives
  // in the result pane so the controls stay put.
  if (loading && !wide) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={palette.accent} size="large" />
      </View>
    )
  }

  // ── Wide: two-pane counter layout ─────────────────────────────────────────
  // Left = scan / manual-lookup controls (always available); right = the
  // verification result + collector context. Touch targets sized up for
  // standing employees.
  if (wide) {
    return (
      <KeyboardAvoidingView
        style={wideStyles.row}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Controls */}
        <View style={wideStyles.leftPane}>
          <Text style={wideStyles.paneTitle}>Look up a visitor</Text>
          <TouchableOpacity
            style={wideStyles.scanBtn}
            onPress={() => router.push('/field/scan')}
            activeOpacity={0.85}
          >
            <Text style={wideStyles.scanBtnText}>Scan visitor QR</Text>
          </TouchableOpacity>

          <View style={wideStyles.orRow}>
            <View style={wideStyles.orLine} />
            <Text style={wideStyles.orText}>OR ENTER CODE</Text>
            <View style={wideStyles.orLine} />
          </View>

          <TextInput
            style={wideStyles.codeInput}
            value={codeInput}
            onChangeText={(t) => setCodeInput(t.toUpperCase())}
            placeholder="e.g. A3F8C2"
            placeholderTextColor="#555"
            maxLength={8}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={handleCodeSubmit}
          />
          <TouchableOpacity
            style={[wideStyles.findBtn, submitting && styles.btnDisabled]}
            onPress={handleCodeSubmit}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={wideStyles.findBtnText}>Find visitor</Text>}
          </TouchableOpacity>
        </View>

        {/* Result + collector context */}
        <View style={wideStyles.rightPane}>
          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator color={palette.accent} size="large" />
            </View>
          ) : collector ? (
            <View style={wideStyles.resultWrap}>
              <View style={styles.card}>
                <Text style={styles.cardLabel}>Visitor</Text>
                <Text style={styles.firstName}>{collector.firstName}</Text>
                <View style={styles.divider} />
                <Text style={styles.detailLabel}>Passport</Text>
                <Text style={styles.detailValue}>{collector.passportTitle}</Text>
                <Text style={styles.detailLabel}>Stop</Text>
                <Text style={styles.detailValue}>{collector.stopName}</Text>

                {alreadyAcknowledged ? (
                  <View style={styles.alreadyBanner}>
                    <Text style={styles.alreadyText}>Already acknowledged today</Text>
                  </View>
                ) : (
                  <TouchableOpacity style={wideStyles.acknowledgeBtn} onPress={handleAcknowledge} activeOpacity={0.85}>
                    <Text style={styles.acknowledgeBtnText}>Acknowledge →</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={styles.ghostBtn}
                  onPress={() => { setCollector(null); setCodeInput(''); setNotFound(false) }}
                >
                  <Text style={styles.ghostBtnText}>Look up a different visitor</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : notFound ? (
            <View style={styles.notFound}>
              <Text style={styles.notFoundText}>No pending stamp found for this code at this stop.</Text>
              <TouchableOpacity style={styles.ghostBtn} onPress={() => { setNotFound(false); setCodeInput('') }}>
                <Text style={styles.ghostBtnText}>Try again</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={wideStyles.emptyState}>
              <Text style={wideStyles.emptyText}>Scan a visitor&apos;s QR or enter their code to begin.</Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    )
  }

  // ── Narrow: single-column (unchanged) ─────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Manual code entry if no userId from QR */}
      {!scannedUserId && !collector && (
        <View style={styles.codeSection}>
          <Text style={styles.sectionTitle}>Enter visitor code</Text>
          <Text style={styles.sectionHint}>Ask them to open their stop screen and show you the 6-character code.</Text>
          <TextInput
            style={styles.codeInput}
            value={codeInput}
            onChangeText={(t) => setCodeInput(t.toUpperCase())}
            placeholder="e.g. A3F8C2"
            placeholderTextColor="#555"
            maxLength={8}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={handleCodeSubmit}
          />
          <TouchableOpacity
            style={[styles.primaryBtn, submitting && styles.btnDisabled]}
            onPress={handleCodeSubmit}
            disabled={submitting}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.primaryBtnText}>Find visitor</Text>}
          </TouchableOpacity>
        </View>
      )}

      {notFound && (
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>No pending stamp found for this code at this stop.</Text>
          <TouchableOpacity style={styles.ghostBtn} onPress={() => { setNotFound(false); setCodeInput('') }}>
            <Text style={styles.ghostBtnText}>Try again</Text>
          </TouchableOpacity>
        </View>
      )}

      {collector && (
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Visitor</Text>
          <Text style={styles.firstName}>{collector.firstName}</Text>
          <View style={styles.divider} />
          <Text style={styles.detailLabel}>Passport</Text>
          <Text style={styles.detailValue}>{collector.passportTitle}</Text>
          <Text style={styles.detailLabel}>Stop</Text>
          <Text style={styles.detailValue}>{collector.stopName}</Text>

          {alreadyAcknowledged ? (
            <View style={styles.alreadyBanner}>
              <Text style={styles.alreadyText}>Already acknowledged today</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.acknowledgeBtn} onPress={handleAcknowledge} activeOpacity={0.85}>
              <Text style={styles.acknowledgeBtnText}>Acknowledge →</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.ghostBtn}
            onPress={() => {
              setCollector(null)
              setCodeInput('')
              setNotFound(false)
            }}
          >
            <Text style={styles.ghostBtnText}>Look up a different visitor</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: palette.navy, padding: 20 },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.navy,
  },
  codeSection: { marginTop: 12 },
  sectionTitle: { fontSize: 20, color: palette.cream, fontFamily: 'serif', marginBottom: 6 },
  sectionHint: { fontSize: 13, color: '#888', fontStyle: 'italic', marginBottom: 20, lineHeight: 19 },
  codeInput: {
    backgroundColor: '#152232', borderRadius: 10, padding: 16,
    color: palette.cream, fontSize: 22, fontFamily: 'monospace',
    borderWidth: 1, borderColor: '#1a2d44', letterSpacing: 4,
    textAlign: 'center', marginBottom: 14,
  },
  primaryBtn: {
    backgroundColor: palette.green, borderRadius: 10, paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.5 },
  notFound: { marginTop: 20, alignItems: 'center' },
  notFoundText: {
    color: '#c0392b', textAlign: 'center', fontSize: 14,
    lineHeight: 20, marginBottom: 16,
  },
  card: {
    backgroundColor: '#152232', borderRadius: 14, padding: 22,
    borderWidth: 1, borderColor: '#1a2d44', marginTop: 12,
  },
  cardLabel: {
    fontSize: 10, color: palette.accent, fontWeight: '700',
    letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6,
  },
  firstName: { fontSize: 32, color: palette.cream, fontFamily: 'serif', fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#1a2d44', marginVertical: 16 },
  detailLabel: {
    fontSize: 10, color: '#888', fontWeight: '700',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 3,
  },
  detailValue: { fontSize: 15, color: palette.cream, marginBottom: 12 },
  alreadyBanner: {
    backgroundColor: '#1a2d44', borderRadius: 8, padding: 14,
    alignItems: 'center', marginTop: 8,
  },
  alreadyText: { color: '#888', fontSize: 14, fontStyle: 'italic' },
  acknowledgeBtn: {
    backgroundColor: palette.accent, borderRadius: 10, paddingVertical: 16,
    alignItems: 'center', marginTop: 8,
  },
  acknowledgeBtnText: { color: palette.navy, fontWeight: '700', fontSize: 17 },
  ghostBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 8 },
  ghostBtnText: { color: '#555', fontSize: 13 },
})

// Landscape counter tablet — two-pane. Targets sized up for standing use.
const wideStyles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', backgroundColor: palette.navy },
  leftPane: {
    width: 340,
    padding: 28,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#1a2d44',
  },
  paneTitle: {
    fontSize: 24, color: palette.cream, fontFamily: 'serif', marginBottom: 24,
  },
  scanBtn: {
    backgroundColor: palette.green, borderRadius: 12, paddingVertical: 20,
    minHeight: 64, alignItems: 'center', justifyContent: 'center',
  },
  scanBtnText: { color: '#fff', fontWeight: '700', fontSize: 18 },
  orRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 22 },
  orLine: { flex: 1, height: 1, backgroundColor: '#1a2d44' },
  orText: {
    color: '#888', fontSize: 11, letterSpacing: 1.5, marginHorizontal: 10, fontWeight: '700',
  },
  codeInput: {
    backgroundColor: '#152232', borderRadius: 10, padding: 18,
    color: palette.cream, fontSize: 24, fontFamily: 'monospace',
    borderWidth: 1, borderColor: '#1a2d44', letterSpacing: 4,
    textAlign: 'center', marginBottom: 16,
  },
  findBtn: {
    backgroundColor: '#1a2d44', borderRadius: 12, paddingVertical: 18,
    minHeight: 60, alignItems: 'center', justifyContent: 'center',
  },
  findBtnText: { color: palette.cream, fontWeight: '700', fontSize: 16 },
  rightPane: { flex: 1, padding: 32, justifyContent: 'center' },
  resultWrap: { maxWidth: 480, width: '100%', alignSelf: 'center' },
  acknowledgeBtn: {
    backgroundColor: palette.accent, borderRadius: 12, paddingVertical: 20,
    minHeight: 64, alignItems: 'center', justifyContent: 'center', marginTop: 8,
  },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 },
  emptyText: {
    color: '#5a6b82', fontSize: 16, textAlign: 'center', fontStyle: 'italic', lineHeight: 24,
  },
})
