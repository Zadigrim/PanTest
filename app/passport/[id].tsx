// Passport book view v2 — single-page-per-screen with left-edge rotateY flip.
// Page sequence: Cover → InsideCover → TOC → [SectionDivider + StopsPage + ExitVisa] × N
import React, { useEffect, useCallback, useState, useMemo, useRef } from 'react'
import {
  View, ActivityIndicator, StyleSheet, Alert, useWindowDimensions,
} from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase, getCurrentUser } from '../../lib/supabase'
import { usePassport } from '../../hooks/usePassport'
import { useGPS, useStampVerification } from '../../hooks/useGPS'
import { checkPageComplete, generateTokenForPage } from '../../lib/token'

import { PassportFrame } from '../../components/passport/PassportFrame'
import { PageFlipper, type PageFlipperHandle } from '../../components/passport/PageFlipper'
import { BookCover } from '../../components/passport/BookCover'
import { InsideCoverPage } from '../../components/passport/InsideCoverPage'
import { TableOfContents } from '../../components/passport/TableOfContents'
import { SectionDivider } from '../../components/passport/SectionDivider'
import { PassportPage } from '../../components/passport/PassportPage'
import { ExitVisa } from '../../components/passport/ExitVisa'
import { StampingOverlay } from '../../components/passport/StampingOverlay'

import type { StampPlacement, StampSlotState, Stop, CollectorPassport, Stamp } from '../../types'

function defaultPlacement(): StampPlacement {
  return { posX: 50, posY: 50, contactSizePx: 80, rotationDeg: Math.random() * 30 - 15 }
}

export default function PassportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { width: sw, height: sh } = useWindowDimensions()
  const pageW = sw * 0.82
  const pageH = sh * 0.96

  const { passport, pages, stops, loading } = usePassport(id)
  const [stamps, setStamps] = useState<Record<string, Record<string, Stamp>>>({})
  const [slotStates, setSlotStates] = useState<Record<string, Record<string, StampSlotState>>>({})
  const [collectorPassport, setCollectorPassport] = useState<CollectorPassport | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [bearerName, setBearerName] = useState<string>('')
  const [stampingStop, setStampingStop] = useState<{ pageId: string; stop: Stop } | null>(null)

  const { checkLocation } = useGPS()
  const { verify } = useStampVerification()
  const flipperRef = useRef<PageFlipperHandle>(null)

  // ── init: auth + collector passport + existing stamps ──────────────────────
  useEffect(() => {
    async function init() {
      const user = await getCurrentUser()
      if (!user) { router.replace('/(auth)/login'); return }
      setUserId(user.id)

      const [cpResult, profileResult] = await Promise.all([
        supabase
          .from('collector_passports')
          .select('*')
          .eq('user_id', user.id)
          .eq('passport_id', id)
          .single(),
        supabase
          .from('profiles')
          .select('display_name')
          .eq('id', user.id)
          .single(),
      ])

      if (!cpResult.data) { router.back(); return }
      setCollectorPassport(cpResult.data)
      setBearerName(profileResult.data?.display_name ?? '')

      const { data: allStamps } = await supabase
        .from('stamps')
        .select('*, stop:stops(page_id)')
        .eq('user_id', user.id)

      const byPage: Record<string, Record<string, Stamp>> = {}
      for (const s of allStamps ?? []) {
        const pageId = (s.stop as any)?.page_id
        if (!pageId) continue
        if (!byPage[pageId]) byPage[pageId] = {}
        byPage[pageId][s.stop_id] = s
      }
      setStamps(byPage)

      const initial: Record<string, Record<string, StampSlotState>> = {}
      for (const p of pages ?? []) {
        initial[p.id] = {}
        for (const stop of stops[p.id] ?? []) {
          initial[p.id][stop.id] = byPage[p.id]?.[stop.id] ? 'stamped' : 'ready'
        }
      }
      setSlotStates(initial)
    }
    if (!loading) init()
  }, [loading, id, pages, stops])

  // ── stamp handlers ─────────────────────────────────────────────────────────
  const handlePressStart = useCallback((pageId: string, stopId: string) => {
    const pageStops = stops[pageId] ?? []
    const stop = pageStops.find((s) => s.id === stopId)
    if (!stop) return
    // Show the stamping overlay instead of inline hold
    setSlotStates((prev) => ({
      ...prev,
      [pageId]: { ...prev[pageId], [stopId]: 'pressing' },
    }))
    setStampingStop({ pageId, stop })
  }, [stops])

  const handlePressCancel = useCallback((pageId: string, stopId: string) => {
    setSlotStates((prev) => ({
      ...prev,
      [pageId]: { ...prev[pageId], [stopId]: 'ready' },
    }))
  }, [])

  const handleStampPlaced = useCallback(async (
    pageId: string,
    stopId: string,
    placement: StampPlacement,
  ) => {
    if (!userId || !collectorPassport) return

    const location = await checkLocation()
    const stopOpenedAt = new Date().toISOString()

    const result = await verify({
      stopId,
      latitude: location?.latitude ?? 0,
      longitude: location?.longitude ?? 0,
      stopOpenedAt,
    })

    if (!result?.verified) {
      Alert.alert(
        'Not quite there',
        result?.reason ?? 'You need to be at the location to stamp.',
      )
      handlePressCancel(pageId, stopId)
      return
    }

    const { data: stampData, error } = await supabase
      .from('stamps')
      .insert({
        user_id: userId,
        stop_id: stopId,
        collector_passport_id: collectorPassport.id,
        geohash: result.geohash,
        stamp_pos_x: placement.posX,
        stamp_pos_y: placement.posY,
        contact_size_px: placement.contactSizePx,
        rotation_deg: placement.rotationDeg,
        verification_method: result.verificationMethod,
        stop_opened_at: stopOpenedAt,
        verified_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error) {
      Alert.alert('Error', 'Could not save stamp.')
      handlePressCancel(pageId, stopId)
      return
    }

    setStamps((prev) => ({
      ...prev,
      [pageId]: { ...prev[pageId], [stopId]: stampData },
    }))
    setSlotStates((prev) => ({
      ...prev,
      [pageId]: { ...prev[pageId], [stopId]: 'stamped' },
    }))

    const isComplete = await checkPageComplete(pageId, userId)
    if (isComplete) {
      try {
        const token = await generateTokenForPage(pageId, userId)
        Alert.alert(
          '★ Section Complete!',
          `Redemption code: ${token.token_code}\n\nShow this to claim your prize.`,
          [
            { text: 'Journal', onPress: () => router.push(`/journal/${stampData.id}`) },
            { text: 'Done' },
          ],
        )
      } catch {
        Alert.alert('Section complete!', 'All stops stamped.')
      }
    } else {
      Alert.alert('Stamped!', 'Add a journal entry?', [
        { text: 'Yes', onPress: () => router.push(`/journal/${stampData.id}`) },
        { text: 'Skip' },
      ])
    }
  }, [userId, collectorPassport, checkLocation, verify, handlePressCancel])

  // ── overlay callbacks ──────────────────────────────────────────────────────
  const handleOverlayStamp = useCallback(() => {
    if (!stampingStop) return
    setStampingStop(null)
    handleStampPlaced(stampingStop.pageId, stampingStop.stop.id, defaultPlacement())
  }, [stampingStop, handleStampPlaced])

  const handleOverlayCancel = useCallback(() => {
    if (!stampingStop) return
    handlePressCancel(stampingStop.pageId, stampingStop.stop.id)
    setStampingStop(null)
  }, [stampingStop, handlePressCancel])

  // ── build page sequence ────────────────────────────────────────────────────
  // pageScreenIndex: maps page.id → index in the pages array (of the StopsPage screen index)
  const pageScreenIndex = useMemo(() => {
    const idx: Record<string, number> = {}
    // Screen order: 0=Cover, 1=InsideCover, 2=TOC, then per page: divider, stops, exitvisa
    let i = 3
    for (const p of pages) {
      idx[p.id] = i + 1 // StopsPage is after SectionDivider
      i += 3
    }
    return idx
  }, [pages])

  const pageNodes = useMemo(() => {
    if (!passport || !collectorPassport) return []

    const nodes: React.ReactNode[] = []

    // 0: Cover
    nodes.push(
      <PassportFrame key="cover" bindingSide="left">
        <BookCover
          passport={passport}
          onOpen={() => flipperRef.current?.goTo(1)}
        />
      </PassportFrame>,
    )

    // 1: Inside cover
    nodes.push(
      <PassportFrame key="inside-cover" bindingSide="left">
        <InsideCoverPage
          passport={passport}
          collectorPassport={collectorPassport}
          bearerName={bearerName}
        />
      </PassportFrame>,
    )

    // 2: Table of contents
    nodes.push(
      <PassportFrame key="toc" bindingSide="left">
        <TableOfContents
          passport={passport}
          pages={pages}
          stops={stops}
          stamps={stamps}
          pageScreenIndex={pageScreenIndex}
          onNavigate={(screenIdx) => flipperRef.current?.goTo(screenIdx)}
        />
      </PassportFrame>,
    )

    // Per DB page: SectionDivider + StopsPage + ExitVisa
    pages.forEach((page, i) => {
      const pageStops = stops[page.id] ?? []
      const pageStamps = stamps[page.id] ?? {}
      const pageSlotStates = slotStates[page.id] ?? {}
      const chapterNum = i + 1

      // Section divider
      nodes.push(
        <PassportFrame key={`divider-${page.id}`} bindingSide="left">
          <SectionDivider
            passport={passport}
            page={page}
            chapterNumber={chapterNum}
          />
        </PassportFrame>,
      )

      // Stops page
      nodes.push(
        <PassportFrame key={`stops-${page.id}`} bindingSide="left">
          <PassportPage
            passport={passport}
            page={page}
            stops={pageStops}
            stamps={pageStamps}
            slotStates={pageSlotStates}
            width={pageW}
            height={pageH}
            onStampPlaced={(stopId, placement) =>
              handleStampPlaced(page.id, stopId, placement)
            }
            onPressStart={(stopId) => handlePressStart(page.id, stopId)}
            onPressCancel={(stopId) => handlePressCancel(page.id, stopId)}
          />
        </PassportFrame>,
      )

      // Exit visa
      nodes.push(
        <PassportFrame key={`exit-${page.id}`} bindingSide="left">
          <ExitVisa
            passport={passport}
            page={page}
            stops={pageStops}
            stamps={pageStamps}
            chapterNumber={chapterNum}
          />
        </PassportFrame>,
      )
    })

    return nodes
  }, [
    passport, collectorPassport, bearerName, pages, stops, stamps,
    slotStates, pageScreenIndex, pageW, pageH,
    handlePressStart, handlePressCancel, handleStampPlaced,
  ])

  // ── render ─────────────────────────────────────────────────────────────────
  if (loading || !passport) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#C9A84C" size="large" />
      </View>
    )
  }

  // Wait until collectorPassport is loaded before showing pages
  if (!collectorPassport) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#C9A84C" size="large" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <PageFlipper
        ref={flipperRef}
        pages={pageNodes}
        initialIndex={0}
      />

      {/* Stamping overlay — modal over the entire book */}
      {stampingStop && (
        <StampingOverlay
          stop={stampingStop.stop}
          onStamp={handleOverlayStamp}
          onCancel={handleOverlayCancel}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#2a1f12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2a1f12',
  },
})
