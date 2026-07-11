// Acknowledge screen — employee confirms they met the visitor.
import React, { useState, useEffect, useRef } from 'react'
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
  Animated, Easing,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase, getCurrentUser } from '../../lib/supabase'
import { useEmployeeContext } from '../../contexts/EmployeeContext'
import { palette } from '../../lib/colors'
import { LandscapeContainer } from '../../components/layout/LandscapeContainer'

export default function AcknowledgeScreen() {
  const { stampId, userId, stopId } = useLocalSearchParams<{
    stampId: string
    userId: string
    stopId: string
  }>()
  const { institutionType } = useEmployeeContext()

  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [recommendCount, setRecommendCount] = useState(0)
  const [recommendLoading, setRecommendLoading] = useState(false)

  // Animated values for the accolade offer fade-in
  const accoladeOpacity = useRef(new Animated.Value(0)).current
  const recommendOpacity = useRef(new Animated.Value(0)).current

  // Auto-dismiss timer ref
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Load collector first name
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (data) setFirstName(data.display_name.split(' ')[0])
      })
  }, [userId])

  useEffect(() => {
    if (confirmed && institutionType === 'library') {
      setRecommendLoading(true)
      supabase
        .from('reading_recommendations')
        .select('id', { count: 'exact', head: true })
        .eq('stamp_id', stampId)
        .then(({ count }) => {
          setRecommendCount(count ?? 0)
          setRecommendLoading(false)
        })
    }
  }, [confirmed, institutionType, stampId])

  useEffect(() => {
    if (confirmed) {
      // Fade in accolade offer after 1.5s
      const t = setTimeout(() => {
        Animated.timing(accoladeOpacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.ease,
          useNativeDriver: true,
        }).start()

        // Fade in recommend option shortly after (library only)
        if (institutionType === 'library') {
          setTimeout(() => {
            Animated.timing(recommendOpacity, {
              toValue: 1,
              duration: 300,
              easing: Easing.ease,
              useNativeDriver: true,
            }).start()
          }, 300)
        }
      }, 1500)

      // Auto-dismiss after 30s if nothing tapped
      dismissTimer.current = setTimeout(() => {
        router.replace('/(tabs)/field')
      }, 30000)

      return () => {
        clearTimeout(t)
        if (dismissTimer.current) clearTimeout(dismissTimer.current)
      }
    }
  }, [confirmed, institutionType, accoladeOpacity, recommendOpacity])

  const handleAcknowledge = async () => {
    setConfirming(true)
    const user = await getCurrentUser()
    if (!user) { router.replace('/(auth)/login'); return }

    // 1. Create presence_session
    await supabase.from('presence_sessions').insert({
      user_id: userId,
      stop_id: stopId,
      employee_id: user.id,
      verified_by_employee: true,
    })

    // 2. Update stamp status → ready
    await supabase
      .from('stamps')
      .update({
        status: 'ready',
        verified_at: new Date().toISOString(),
        verified_by: user.id,
      })
      .eq('id', stampId)

    setConfirming(false)
    setConfirmed(true)
  }

  const handleDone = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    router.replace('/(tabs)/field')
  }

  const handleAccolade = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    router.push({
      pathname: '/field/accolade',
      params: { stampId, userId, stopId },
    })
  }

  const handleRecommend = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current)
    router.push({
      pathname: '/field/recommend',
      params: { stampId, userId, stopId },
    })
  }

  return (
    <LandscapeContainer>
    <View style={styles.container}>
      {!confirmed ? (
        <>
          <View style={styles.header}>
            <Text style={styles.prompt}>I met this visitor</Text>
            {firstName ? <Text style={styles.nameHint}>{firstName}</Text> : null}
          </View>
          <TouchableOpacity
            style={[styles.bigBtn, confirming && styles.bigBtnDisabled]}
            onPress={handleAcknowledge}
            disabled={confirming}
            activeOpacity={0.8}
          >
            {confirming
              ? <ActivityIndicator color={palette.navy} size="large" />
              : <Text style={styles.bigBtnText}>I met this visitor ✓</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.confirmedContainer}>
          <Text style={styles.doneIcon}>✓</Text>
          <Text style={styles.doneText}>
            Done.{firstName ? ` ${firstName}` : ''} can now place their stamp.
          </Text>

          {/* Accolade offer fades in after 1.5s */}
          <Animated.View style={[styles.accoladeRow, { opacity: accoladeOpacity }]}>
            <TouchableOpacity style={styles.accoladeBtn} onPress={handleAccolade} activeOpacity={0.8}>
              <Text style={styles.accoladeBtnText}>Give an accolade →</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Library-only: recommend a book */}
          {institutionType === 'library' && !recommendLoading && recommendCount < 3 && (
            <Animated.View style={[styles.recommendRow, { opacity: recommendOpacity }]}>
              <TouchableOpacity style={styles.recommendBtn} onPress={handleRecommend} activeOpacity={0.8}>
                <Text style={styles.recommendBtnText}>Recommend a book →</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
    </LandscapeContainer>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: palette.navy,
    padding: 24, justifyContent: 'center',
  },
  header: { marginBottom: 24, alignItems: 'center' },
  prompt: { fontSize: 18, color: '#888', fontStyle: 'italic', marginBottom: 6 },
  nameHint: { fontSize: 24, color: palette.cream, fontFamily: 'serif', fontWeight: '700' },
  bigBtn: {
    backgroundColor: palette.accent,
    borderRadius: 14,
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  bigBtnDisabled: { opacity: 0.6 },
  bigBtnText: {
    color: palette.navy, fontWeight: '700', fontSize: 22, textAlign: 'center',
  },
  confirmedContainer: { alignItems: 'center' },
  doneIcon: { fontSize: 52, color: palette.green, marginBottom: 12 },
  doneText: {
    fontSize: 20, color: palette.cream, fontFamily: 'serif',
    textAlign: 'center', lineHeight: 28, marginBottom: 32,
  },
  accoladeRow: { width: '100%', marginBottom: 10 },
  accoladeBtn: {
    borderWidth: 1, borderColor: palette.accent, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  accoladeBtnText: { color: palette.accent, fontWeight: '600', fontSize: 16 },
  recommendRow: { width: '100%', marginBottom: 10 },
  recommendBtn: {
    borderWidth: 1, borderColor: palette.green, borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  recommendBtnText: { color: palette.green, fontWeight: '600', fontSize: 16 },
  doneBtn: { marginTop: 24, paddingVertical: 12, paddingHorizontal: 32 },
  doneBtnText: { color: '#555', fontSize: 15 },
})
