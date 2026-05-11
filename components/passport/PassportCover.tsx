import React from 'react'
import { View, Text, StyleSheet, ImageBackground } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import type { Passport } from '../../types'

interface Props {
  passport: Passport
  width: number
  height: number
}

export function PassportCover({ passport, width, height }: Props) {
  return (
    <View style={[styles.cover, { width, height, backgroundColor: passport.cover_bg_color }]}>
      {passport.cover_bg_type === 'gradient' && (
        <LinearGradient
          colors={[passport.cover_bg_color, passport.cover_bg_color + 'CC', '#1a2d44']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
      )}

      {passport.cover_bg_type === 'image' && passport.cover_image_url && (
        <ImageBackground
          source={{ uri: passport.cover_image_url }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        >
          <View style={[StyleSheet.absoluteFill, { backgroundColor: passport.cover_bg_color + '99' }]} />
        </ImageBackground>
      )}

      {/* Spine line */}
      <View style={styles.spineLine} />

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.emblem}>{passport.cover_emblem ?? '🧭'}</Text>
        <Text style={styles.title}>{passport.title}</Text>
        {passport.description && (
          <Text style={styles.subtitle} numberOfLines={2}>{passport.description}</Text>
        )}
        <View style={styles.bottomLine} />
        <Text style={styles.brand}>OKUJI</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  cover: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  spineLine: {
    position: 'absolute',
    left: 24,
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: 'rgba(201,168,76,0.35)',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emblem: {
    fontSize: 52,
    marginBottom: 12,
  },
  title: {
    fontFamily: 'serif',
    fontSize: 22,
    fontWeight: '700',
    color: '#F5F0E8',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(245,240,232,0.65)',
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 32,
  },
  bottomLine: {
    width: 80,
    height: 0.5,
    backgroundColor: 'rgba(201,168,76,0.6)',
    marginBottom: 12,
  },
  brand: {
    fontSize: 10,
    letterSpacing: 4,
    color: 'rgba(201,168,76,0.7)',
    fontWeight: '600',
  },
})
