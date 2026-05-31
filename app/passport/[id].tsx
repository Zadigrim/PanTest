// Passport book view v2 — single-page-per-screen with left-edge rotateY flip.
// Page sequence: Cover → InsideCover → TOC → [SectionDivider + StopsPage + ExitVisa] × N
import React, { useEffect, useCallback, useState, useMemo, useRef } from 'react'
import {
  View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert, useWindowDimensions,
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
import { palette } from '../../lib/colors'

// BLD-32: a passport.is_demo + viewer-is-platform-admin pair. Activates the
// stamp-flow bypass and renders the persistent banner. Non-admins viewing
// a demo passport see normal behavior (no bypass, no banner) — the flag is
// an admin-only override, not a relaxation of the public access model.
function useDemoMode(passportIsDemo: boolean | undefined, isAdmin: boolean) {
  return Boolean(isAdmin && passportIsDemo)
}

function defaultPlacement(): StampPlacement {
  return { posX: 50, posY: 50, contactSizePx: 80, rotationDeg: Math.random() * 30 - 15 }
}

export default function PassportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { width: sw, height: sh } = useWindowDimensions()
  const pageW = sw * 0.82
  const pageH = sh * 0.96

  const { passport, pages, stops, loading, reload: reloadPassport } = usePassport(id)
  const [stamps, setStamps] = useState<Record<string, Record<string, Stamp>>>({})
  const [slotStates, setSlotStates] = useState<Record<string, Record<string, StampSlotState>>>({})
  const [collectorPassport, setCollectorPassport] = useState<CollectorPassport | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [bearerName, setBearerName] = useState<string>('')
  const [stampingStop, setStampingStop] = useState<{ pageId: string; stop: Stop } | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [togglingDemo, setTogglingDemo] = useState(false)

  const { checkLocation } = useGPS()
  const { verify } = useStampVerification()
  const flipperRef = useRef<PageFlipperHandle>(null)

  const isDemo = useDemoMode(passport?.is_demo, isAdmin)

  // ── init: auth + collector passport + existing stamps ──────────────────────
  useEffect(() => {
    async function init() {
      const user = await getCurrentUser()
      if (!user) { router.replace('/(auth)/login'); return }
      setUserId(user.id)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adminResult = await (supabase as any).rpc('is_platform_admin')
      const callerIsAdmin = adminResult?.data === true
      setIsAdmin(callerIsAdmin)

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

      let cp = cpResult.data
      if (!cp) {
        // BLD-32: platform admin viewing a demo passport without owning a
        // collector_passports row gets one auto-created. The acquisition
        // gate is one of the constraints demo mode explicitly bypasses
        // per the locked spec. The row is a real row (untagged) and gets
        // truncated alongside the demo passport pre-launch.
        if (callerIsAdmin && passport?.is_demo) {
          const { data: newCp } = await supabase
            .from('collector_passports')
            .insert({ user_id: user.id, passport_id: id })
            .select()
            .single()
          if (!newCp) { router.back(); return }
          cp = newCp
        } else {
          router.back(); return
        }
      }
      setCollectorPassport(cp)
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

    const stopOpenedAt = new Date().toISOString()

    // BLD-32: in demo mode, skip GPS check + verify. The stamp INSERT is
    // unchanged structurally; verification_method is recorded as
    // 'self_reported' so the row isn't claiming GPS verification it didn't
    // do, but is otherwise indistinguishable from a real self-reported
    // stamp (no is_demo_data tag per the locked spec). Demo passports get
    // TRUNCATEd pre-launch.
    let verifiedGeohash: string | null = null
    let verificationMethod: string = 'self_reported'
    if (!isDemo) {
      const location = await checkLocation()
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
      verifiedGeohash = result.geohash
      verificationMethod = result.verificationMethod
    }

    const { data: stampData, error } = await supabase
      .from('stamps')
      .insert({
        user_id: userId,
        stop_id: stopId,
        collector_passport_id: collectorPassport.id,
        geohash: verifiedGeohash,
        stamp_pos_x: placement.posX,
        stamp_pos_y: placement.posY,
        contact_size_px: placement.contactSizePx,
        rotation_deg: placement.rotationDeg,
        verification_method: verificationMethod,
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
  }, [userId, collectorPassport, isDemo, checkLocation, verify, handlePressCancel])

  // BLD-32: admin-only toggle for passports.is_demo. Reload the passport
  // via the usePassport hook so isDemo derives off the new value.
  const handleToggleDemo = useCallback(async () => {
    if (!passport || togglingDemo) return
    setTogglingDemo(true)
    const next = !passport.is_demo
    const { error } = await supabase
      .from('passports')
      .update({ is_demo: next })
      .eq('id', passport.id)
    if (error) {
      Alert.alert('Demo mode', error.message)
    } else {
      await reloadPassport()
    }
    setTogglingDemo(false)
  }, [passport, togglingDemo, reloadPassport])

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
        <ActivityIndicator color={palette.accent} size="large" />
      </View>
    )
  }

  // Wait until collectorPassport is loaded before showing pages
  if (!collectorPassport) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={palette.accent} size="large" />
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

      {/* BLD-32 demo banner + admin toggle. The banner is intentionally
          obtrusive — demo stamps must never be mistaken for real ones.
          The toggle is admin-only and visible whether demo is on or off so
          an admin can flip it from inside the passport view itself. */}
      {isDemo && (
        <View pointerEvents="none" style={styles.demoBanner}>
          <Text style={styles.demoBannerText}>DEMO MODE — constraints bypassed</Text>
        </View>
      )}
      {isAdmin && (
        <TouchableOpacity
          onPress={handleToggleDemo}
          disabled={togglingDemo}
          style={[styles.demoTogglePill, isDemo && styles.demoTogglePillActive]}
          accessibilityLabel={isDemo ? 'Turn demo mode off' : 'Turn demo mode on'}
        >
          <Text style={[styles.demoToggleText, isDemo && styles.demoToggleTextActive]}>
            {togglingDemo ? '…' : isDemo ? 'DEMO: ON' : 'DEMO: OFF'}
          </Text>
        </TouchableOpacity>
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
  // ── BLD-32 demo mode overlay ─────────────────────────────────────────────
  demoBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 44, // clear the status bar
    paddingBottom: 8,
    backgroundColor: '#C0392B',
    alignItems: 'center',
  },
  demoBannerText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  demoTogglePill: {
    position: 'absolute',
    top: 48,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  demoTogglePillActive: {
    backgroundColor: '#fff',
    borderColor: '#fff',
  },
  demoToggleText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.85)',
  },
  demoToggleTextActive: {
    color: '#C0392B',
  },
})
