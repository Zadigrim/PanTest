// Two-page passport spread for the designer canvas.
// Same visual treatment as the reader's PassportFrame but no flip animation.
// Left page is the section divider preview; right page shows stamp slots.
import React from 'react'
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'

const INK      = '#1f1d1a'
const PAPER    = '#f6f1e6'
const HAIRLINE = '#c8bfa9'
const ACCENT   = '#c9a84c'

const SPREAD_RATIO = 2 / 3   // page width : height
const MAX_PAGE_W   = 280
const MAX_PAGE_H   = 380

export function useSpreadDimensions() {
  const { width, height } = useWindowDimensions()
  // Available canvas width minus rails (approximate)
  const availW = Math.min(width - 460, MAX_PAGE_W * 2 + 24)
  const pageW  = Math.max(140, Math.min(availW / 2 - 12, MAX_PAGE_W))
  const pageH  = pageW / SPREAD_RATIO
  return { pageW, pageH }
}

interface Props {
  leftContent: React.ReactNode
  rightContent: React.ReactNode
}

export function PassportSpread({ leftContent, rightContent }: Props) {
  const { pageW, pageH } = useSpreadDimensions()

  return (
    <View style={spread.root}>
      <Page width={pageW} height={pageH} side="left">{leftContent}</Page>
      <View style={spread.spine} />
      <Page width={pageW} height={pageH} side="right">{rightContent}</Page>
    </View>
  )
}

function Page({
  width, height, side, children,
}: {
  width: number; height: number; side: 'left' | 'right'; children: React.ReactNode
}) {
  return (
    <View
      style={[
        page.root,
        { width, height },
        side === 'left' ? page.shadowLeft : page.shadowRight,
      ]}
    >
      {/* Binding strip */}
      <LinearGradient
        colors={side === 'left' ? ['#ddd5c0', '#e8e0cc', '#ddd5c0'] : ['#ddd5c0', '#e8e0cc', '#ddd5c0']}
        start={side === 'left' ? { x: 1, y: 0 } : { x: 0, y: 0 }}
        end={side === 'left' ? { x: 0, y: 0 } : { x: 1, y: 0 }}
        style={[page.binding, side === 'left' ? { right: 0 } : { left: 0 }]}
      />
      {/* Horizontal rule lines */}
      {Array.from({ length: Math.floor(height / 22) }).map((_, i) => (
        <View
          key={i}
          style={[page.rule, { top: (i + 1) * 22 }]}
        />
      ))}
      {/* Content */}
      <View style={page.content}>
        {children}
      </View>
    </View>
  )
}

const spread = StyleSheet.create({
  root: { flexDirection: 'row', alignItems: 'flex-start' },
  spine: {
    width: 8,
    alignSelf: 'stretch',
    backgroundColor: '#c4b99a',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
})

const page = StyleSheet.create({
  root: {
    backgroundColor: PAPER,
    borderWidth: 1.5,
    borderColor: INK,
    overflow: 'hidden',
    position: 'relative',
  },
  shadowLeft: {
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 0,
    elevation: 3,
  },
  shadowRight: {
    shadowColor: '#000',
    shadowOffset: { width: 4, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 0,
    elevation: 3,
  },
  binding: { position: 'absolute', top: 0, bottom: 0, width: 8 },
  rule: {
    position: 'absolute', left: 8, right: 8, height: StyleSheet.hairlineWidth,
    backgroundColor: HAIRLINE, opacity: 0.6,
  },
  content: { flex: 1, padding: 12 },
})
