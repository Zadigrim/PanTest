// Dark (#2a1f12) bezel that frames every passport page.
// Provides: 2px ink border, hard drop-shadow, inset vignette, horizontal rule overlay, binding gradient.
import React from 'react'
import { View, StyleSheet, useWindowDimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { palette } from '../../lib/colors'

interface Props {
  children: React.ReactNode
  bindingSide?: 'left' | 'right'
}

const FRAME_BG = '#2a1f12'
const BORDER_COLOR = palette.ink
const RULE_COLOR = 'rgba(0,0,0,0.055)'
const RULE_SPACING = 22

export function usePageDimensions() {
  const { width: sw, height: sh } = useWindowDimensions()
  return { pageW: sw * 0.82, pageH: sh * 0.96 }
}

export function PassportFrame({ children, bindingSide = 'left' }: Props) {
  const { pageW, pageH } = usePageDimensions()
  const ruleCount = Math.ceil(pageH / RULE_SPACING) + 1

  return (
    <View style={[styles.frame, { backgroundColor: FRAME_BG }]}>
      <View
        style={[
          styles.page,
          {
            width: pageW,
            height: pageH,
            borderColor: BORDER_COLOR,
            // hard drop shadow (no blur)
            shadowOffset: { width: 6, height: 8 },
            shadowOpacity: 0.32,
            shadowRadius: 0,
          },
        ]}
      >
        {/* Page content */}
        {children}

        {/* Horizontal rule pattern overlay */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {Array.from({ length: ruleCount }).map((_, i) => (
            <View
              key={i}
              style={[styles.rule, { top: i * RULE_SPACING + 18 }]}
            />
          ))}
        </View>

        {/* Inset vignette — top/bottom */}
        <LinearGradient
          colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0)']}
          style={styles.insetTop}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.08)']}
          style={styles.insetBottom}
          pointerEvents="none"
        />
        {/* Inset vignette — left/right */}
        <LinearGradient
          colors={['rgba(0,0,0,0.08)', 'rgba(0,0,0,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.insetLeft}
          pointerEvents="none"
        />
        <LinearGradient
          colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.08)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.insetRight}
          pointerEvents="none"
        />

        {/* 8px binding gradient on spine side */}
        {bindingSide === 'left' ? (
          <LinearGradient
            colors={['rgba(0,0,0,0.30)', 'rgba(0,0,0,0)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.bindingLeft}
            pointerEvents="none"
          />
        ) : (
          <LinearGradient
            colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.30)']}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.bindingRight}
            pointerEvents="none"
          />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  page: {
    borderWidth: 2,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: '#000',
    backgroundColor: '#fff',
  },
  rule: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: RULE_COLOR,
  },
  insetTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 30,
  },
  insetBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
  },
  insetLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 30,
  },
  insetRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 30,
  },
  bindingLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 8,
  },
  bindingRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 8,
  },
})
