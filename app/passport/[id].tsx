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
import { PostStampCaptureSheet } from '../../components/passport/PostStampCaptureSheet'

import type { StampPlacement, StampSlotState, CollectorPassport, Stamp } from '../../types'
import { palette } from '../../lib/colors'

// BLD-32: a passport.is_demo + viewer-is-platform-admin pair. Activates the
// stamp-flow bypass and renders the persistent banner. Non-admins viewing
// a demo passport see normal behavior (no bypass, no banner) — the flag is
// an admin-only override, not a relaxation of the public access model.
function useDemoMode(passportIsDemo: boolean | undefined, isAdmin: boolean) {
  return Boolean(isAdmin && passportIsDemo)
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
  const [isAdmin, setIsAdmin] = useState(false)
  const [togglingDemo, setTogglingDemo] = useState(false)
  // Post-stamp capture surface state. stampId is the just-placed stamp;
  // redemptionCode is non-null when the stamp completed a section.
  const [captureSheet, setCaptureSheet] = useState<{ stampId: string; redemptionCode: string | null } | null>(null)

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
    // passport?.is_demo intentionally in deps: an admin flipping demo on
    // for a passport they don't own re-runs init to auto-acquire. The
    // SELECTs and INSERT inside init are idempotent on subsequent runs.
  }, [loading, id, pages, stops, passport?.is_demo])

  // ── Correction-notice state ────────────────────────────────────────────────
  // Holder banner: shows the latest republish_log entry's
  // what_changed iff it post-dates the holder's
  // last_correction_dismissed_at on collector_passports.
  // Dismiss writes the timestamp directly via supabase
  // (RLS allows self-update on collector_passports — see
  // mig 012's collector_passports policies).
  const [notice, setNotice] = useState<{ what_changed: string; republished_at: string } | null>(null)
  useEffect(() => {
    if (!collectorPassport || !id) return
    void (async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any
      const { data: logs } = await db
        .from('passport_republish_log')
        .select('what_changed, republished_at')
        .eq('passport_id', id)
        .order('republished_at', { ascending: false })
        .limit(1)
      const latest = ((logs ?? []) as { what_changed: string; republished_at: string }[])[0]
      if (!latest) { setNotice(null); return }
      const dismissedAt = (collectorPassport as { last_correction_dismissed_at?: string | null }).last_correction_dismissed_at
      if (!dismissedAt || new Date(latest.republished_at) > new Date(dismissedAt)) {
        setNotice(latest)
      } else {
        setNotice(null)
      }
    })()
  }, [collectorPassport, id])

  const handleDismissNotice = useCallback(async () => {
    setNotice(null)
    if (!userId || !id) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from('collector_passports')
      .update({ last_correction_dismissed_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('passport_id', id)
  }, [userId, id])

  // ── stamp handlers ─────────────────────────────────────────────────────────
  // handlePressStart only flips the slot to 'pressing' so the slot's
  // pulse animation stops while the gesture is in progress. The gesture
  // component (StampGestureInteraction) does its own live preview and
  // delivers the computed placement directly to handleStampPlaced on
  // release or at the 2 s cap. There is no longer a modal-based
  // confirmation step.
  const handlePressStart = useCallback((pageId: string, stopId: string) => {
    setSlotStates((prev) => ({
      ...prev,
      [pageId]: { ...prev[pageId], [stopId]: 'pressing' },
    }))
  }, [])

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
        // Gesture-derived appearance (migration 040). Optional on the
        // StampPlacement type so legacy callers without these still
        // type-check; the gesture component fills them in.
        saturation: placement.saturation ?? null,
        smudge_dx: placement.smudgeDx ?? null,
        smudge_dy: placement.smudgeDy ?? null,
        smudge_intensity: placement.smudgeIntensity ?? null,
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

    // Per Part 4: replace the post-stamp Alert with a unified capture
    // surface. The sheet renders inline over the passport page and
    // offers voice + photo independently; both, either, or neither.
    // The page-completion token (when present) surfaces as a banner
    // above the journal primitives inside the sheet so it isn't dropped.
    let redemptionCode: string | null = null
    const isComplete = await checkPageComplete(pageId, userId)
    if (isComplete) {
      try {
        const token = await generateTokenForPage(pageId, userId)
        redemptionCode = token.token_code
      } catch {
        // Fall through — sheet still opens, just without the token banner.
        // Completing-the-page itself is a database-side concept, so the
        // missing token doesn't affect stamp state.
      }
    }
    setCaptureSheet({ stampId: stampData.id, redemptionCode })
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

  // (Modal-based overlay callbacks removed in the expressive-gesture PR.
  // The gesture component now delivers placement directly to
  // handleStampPlaced; there is no separate confirmation step.)

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
      {notice && (
        <View style={correctionStyles.banner}>
          <View style={correctionStyles.body}>
            <Text style={correctionStyles.title}>
              This passport was corrected
              <Text style={correctionStyles.date}>
                {' · '}{new Date(notice.republished_at).toLocaleDateString()}
              </Text>
            </Text>
            <Text style={correctionStyles.line}>{notice.what_changed}</Text>
          </View>
          <TouchableOpacity onPress={handleDismissNotice} accessibilityLabel="Dismiss correction notice">
            <Text style={correctionStyles.dismiss}>Got it</Text>
          </TouchableOpacity>
        </View>
      )}
      <PageFlipper
        ref={flipperRef}
        pages={pageNodes}
        initialIndex={0}
      />

      {/* (The pre-stamp modal overlay was removed in the expressive-
          gesture PR — gesture + live preview live in the LocationBox
          itself, see components/stamp/StampGestureInteraction.tsx.) */}

      {/* Post-stamp capture surface — replaces the previous Alert.
          Voice + photo are independently optional. */}
      {userId && (
        <PostStampCaptureSheet
          stampId={captureSheet?.stampId ?? null}
          redemptionCode={captureSheet?.redemptionCode ?? null}
          userId={userId}
          onClose={() => setCaptureSheet(null)}
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

// ── Correction-notice banner (holder-side) ─────────────────
// Co-located with the screen because it consumes the screen's
// existing supabase client + state. Mirrors the web
// CorrectionNoticeBanner in copy + behavior.
const correctionStyles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FAF0D5',   // accent at ~25% — palette.accent + paper
    borderColor: '#C9A84C',       // palette.accent literal
    borderWidth: 1.5,
    borderRadius: 10,
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  body: { flex: 1, minWidth: 0 },
  title: {
    color: '#1f1d1a',
    fontSize: 12.5,
    fontWeight: '700',
  },
  date: {
    color: '#6b6356',
    fontWeight: '400',
  },
  line: {
    color: '#1f1d1a',
    fontSize: 12,
    marginTop: 2,
  },
  dismiss: {
    color: '#6b6356',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#C8BFA9',
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
})
