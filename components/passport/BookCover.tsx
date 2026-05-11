// Passport book cover — deep green (#2E7D4D), left spine accent, top-right red ribbon tab.
// Tap anywhere to open (triggers onOpen).
import React from 'react'
import {
  View, Text, StyleSheet, TouchableOpacity, useWindowDimensions,
} from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import type { Passport } from '../../types'

interface Props {
  passport: Passport
  onOpen: () => void
}

const COVER_GREEN = '#2E7D4D'
const SPINE_ACCENT = '#1a5c33'
const RIBBON_RED = '#9b2335'
const CREAM = '#f6f1e6'
const GOLD = '#c9a84c'

export function BookCover({ passport, onOpen }: Props) {
  const { width: sw, height: sh } = useWindowDimensions()
  const pageW = sw * 0.82
  const pageH = sh * 0.96

  return (
    <TouchableOpacity
      style={[styles.cover, { width: pageW, height: pageH, backgroundColor: COVER_GREEN }]}
      onPress={onOpen}
      activeOpacity={0.92}
    >
      {/* Subtle gradient for depth */}
      <LinearGradient
        colors={[COVER_GREEN, '#1d5c35', '#143d24']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Left spine accent strip */}
      <LinearGradient
        colors={[SPINE_ACCENT, '#0f3d20']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.spineAccent}
      />
      {/* Thin gold spine line */}
      <View style={styles.spineLine} />

      {/* Top-right red ribbon tab */}
      <View style={styles.ribbonContainer} pointerEvents="none">
        <View style={[styles.ribbon, { backgroundColor: RIBBON_RED }]}>
          <Text style={styles.ribbonText}>★</Text>
        </View>
      </View>

      {/* Center content */}
      <View style={styles.content}>
        {/* Top decorative rule */}
        <View style={styles.decorativeRule} />

        {/* Emblem */}
        <Text style={styles.emblem}>{passport.cover_emblem ?? '🧭'}</Text>

        {/* Title */}
        <Text style={styles.title}>{passport.title.toUpperCase()}</Text>

        {/* Subtitle / description */}
        {passport.description ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {passport.description}
          </Text>
        ) : null}

        {/* Horizontal divider */}
        <View style={styles.midRule} />

        {/* Brand */}
        <Text style={styles.brand}>OKUJI</Text>

        {/* Bottom decorative rule */}
        <View style={styles.decorativeRule} />

        {/* Open hint */}
        <Text style={styles.openHint}>tap to open</Text>
      </View>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  cover: {
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  spineAccent: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 24,
  },
  spineLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 24,
    width: 0.5,
    backgroundColor: 'rgba(201,168,76,0.4)',
  },
  ribbonContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 52,
    height: 52,
    overflow: 'hidden',
  },
  ribbon: {
    position: 'absolute',
    top: -18,
    right: -18,
    width: 56,
    height: 56,
    transform: [{ rotate: '45deg' }],
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 4,
  },
  ribbonText: {
    color: CREAM,
    fontSize: 9,
    fontWeight: '700',
    transform: [{ rotate: '-45deg' }],
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 44,
    paddingLeft: 52,
  },
  decorativeRule: {
    width: 120,
    height: 0.5,
    backgroundColor: 'rgba(201,168,76,0.45)',
    marginVertical: 10,
  },
  emblem: {
    fontSize: 56,
    marginBottom: 14,
  },
  title: {
    fontFamily: 'serif',
    fontSize: 20,
    fontWeight: '700',
    color: CREAM,
    textAlign: 'center',
    letterSpacing: 2.5,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 11,
    color: 'rgba(246,241,230,0.6)',
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 18,
    lineHeight: 16,
  },
  midRule: {
    width: 80,
    height: 0.5,
    backgroundColor: `${GOLD}88`,
    marginVertical: 10,
  },
  brand: {
    fontSize: 9,
    letterSpacing: 5,
    color: `${GOLD}cc`,
    fontWeight: '700',
    marginBottom: 4,
  },
  openHint: {
    fontSize: 9,
    color: 'rgba(246,241,230,0.35)',
    fontStyle: 'italic',
    letterSpacing: 1,
    marginTop: 20,
  },
})
