// Passport book view v2 — single-page-per-screen with left-edge rotateY flip.
// Page sequence: Cover → InsideCover → [ToC?] → [StopsPage + ExitVisa?] × N
// (ToC and ExitVisa are reader-toggleable in Profile; section dividers removed.)
import React, { useEffect, useCallback, useState, useMemo, useRef } from 'react'
import {
  View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Alert,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useLocalSearchParams, router } from 'expo-router'
import { supabase, getCurrentUser } from '../../lib/supabase'
import { usePassport, acquirePassport } from '../../hooks/usePassport'
import { useGPS, useStampVerification } from '../../hooks/useGPS'
import { useDemoContext } from '../../contexts/DemoContext'
import { checkPageComplete, generateTokenForPage } from '../../lib/token'

import { PassportFrame, usePageDimensions } from '../../components/passport/PassportFrame'
import { PageFlipper, type PageFlipperHandle } from '../../components/passport/PageFlipper'
import { BookCover } from '../../components/passport/BookCover'
import { InsideCoverPage } from '../../components/passport/InsideCoverPage'
import { TableOfContents } from '../../components/passport/TableOfContents'
import { getViewerPrefs, DEFAULT_VIEWER_PREFS, ViewerPrefsContext, type ViewerPrefs } from '../../lib/viewer-prefs'
import { PassportPage } from '../../components/passport/PassportPage'
import { ExitVisa } from '../../components/passport/ExitVisa'
import { PostStampCaptureSheet } from '../../components/passport/PostStampCaptureSheet'
import { BackJournalCover, BackJournalPage } from '../../components/passport/BackJournalPage'
import { QRScanSheet } from '../../components/stamp/QRScanSheet'
import { useBackPages } from '../../hooks/useBackPages'
import { packBackPages, BACK_PAGE_PAD_X, BACK_PAGE_PAD_TOP, BACK_PAGE_PAD_BOTTOM } from '../../lib/back-pages-layout'

import type { StampPlacement, StampSlotState, CollectorPassport, Stamp, Stop } from '../../types'
import { palette } from '../../lib/colors'

// Whether stamping this stop requires a real QR scan. Reads the canonical
// experience_verification_method (CLAUDE.md invariant 5) with the derived
// verification_tier / legacy evidence_tier as fallback for pre-046 rows
// (tiers 1/2 are the QR+GPS tiers in verify-stamp).
function stopRequiresQr(stop: Stop): boolean {
  if (stop.experience_verification_method != null) {
    return stop.experience_verification_method === 'qr'
  }
  const tier = stop.verification_tier ?? stop.evidence_tier ?? 5
  return tier === 1 || tier === 2
}

export default function PassportScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { pageW, pageH } = usePageDimensions()

  const { passport, pages, stops, loading } = usePassport(id)
  const [stamps, setStamps] = useState<Record<string, Record<string, Stamp>>>({})
  const [slotStates, setSlotStates] = useState<Record<string, Record<string, StampSlotState>>>({})
  const [collectorPassport, setCollectorPassport] = useState<CollectorPassport | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [bearerName, setBearerName] = useState<string>('')
  // Post-stamp capture surface state. stampId is the just-placed stamp;
  // redemptionCode is non-null when the stamp completed a section.
  const [captureSheet, setCaptureSheet] = useState<{ stampId: string; stopId: string; redemptionCode: string | null } | null>(null)

  const { checkLocation } = useGPS()
  const { verify } = useStampVerification()
  const flipperRef = useRef<PageFlipperHandle>(null)
  const [navIdx, setNavIdx] = useState(0)
  // Reader display prefs (Table of contents / Exit visa) — personal toggles
  // from Profile, not part of the kobo design. Loaded once at mount; opening
  // a book afresh reflects the latest choice. Defaults match prior behavior.
  const [prefs, setPrefs] = useState<ViewerPrefs>(DEFAULT_VIEWER_PREFS)
  useEffect(() => { getViewerPrefs().then(setPrefs) }, [])

  // Private back-pages: per-stop travel record for the current user. All
  // queries are auth.uid()-scoped (RLS), so this is never another viewer's
  // content. Re-runs when a new stamp lands (the hook keys on stamp ids).
  const { records: backPages } = useBackPages({
    stopsByPage: stops,
    stampsByPage: stamps,
    userId,
    echoReviews: prefs.echoReviews,
    enabled: prefs.showBackPages,
  })

  // Contained demo mode: demoActive = server-authorized (is_demo_authorized)
  // AND the profile toggle is on. Every bypass below is re-checked
  // server-side (verify-stamp / ensure_collector_passport); this flag only
  // chooses which requests the client makes.
  const { demoActive } = useDemoContext()

  // QR-scan-on-press state: when a placement lands on a QR-verified stop,
  // the scanner sheet opens and the placement waits here until the code
  // is scanned (or the scan is cancelled). Scanned codes are cached per
  // stop for the session so re-stamping after a failed GPS check doesn't
  // demand a second scan.
  const [pendingScan, setPendingScan] = useState<{
    pageId: string
    stopId: string
    stopName?: string
    placement: StampPlacement
  } | null>(null)
  const scannedCodes = useRef<Record<string, string>>({})

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

      let cp = cpResult.data
      if (!cp) {
        // Demo mode: an authorized demo user opening an unowned passport
        // acquires it through the server path (ensure_collector_passport
        // p_demo — authorization re-checked in the function, row marked
        // acquired_demo). Replaces the old BLD-32 client-side INSERT.
        if (demoActive) {
          const { data: demoCp } = await acquirePassport(id, user.id, { demo: true })
          if (!demoCp) { router.back(); return }
          // RPC returns the row shape minus user/passport ids; refetch the
          // full row so downstream consumers see a normal CollectorPassport.
          const { data: fullCp } = await supabase
            .from('collector_passports')
            .select('*')
            .eq('user_id', user.id)
            .eq('passport_id', id)
            .single()
          if (!fullCp) { router.back(); return }
          cp = fullCp
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
    // demoActive intentionally in deps: turning the profile demo toggle
    // on re-runs init so an unowned passport demo-acquires. The SELECTs
    // and the RPC inside init are idempotent on subsequent runs.
  }, [loading, id, pages, stops, demoActive])

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

  // Verification + write both happen in the verify-stamp function (the
  // only stamp writer since migration 026 — client INSERT on stamps is
  // revoked). Demo mode sends demo: true, which the function honors only
  // after its own is_demo_authorized() check; the stamp comes back marked
  // is_demo / verification_method 'demo'.
  const submitStamp = useCallback(async (
    pageId: string,
    stopId: string,
    placement: StampPlacement,
    qrCodeId?: string,
  ) => {
    if (!userId || !collectorPassport) return

    const stopOpenedAt = new Date().toISOString()
    const placementBody = {
      posX: placement.posX,
      posY: placement.posY,
      contactSizePx: placement.contactSizePx,
      rotationDeg: placement.rotationDeg,
      // Gesture-derived appearance (migration 040). Optional on the
      // StampPlacement type so legacy callers without these still
      // type-check; the gesture component fills them in.
      saturation: placement.saturation,
      smudgeDx: placement.smudgeDx,
      smudgeDy: placement.smudgeDy,
      smudgeIntensity: placement.smudgeIntensity,
      tiltDx: placement.tiltDx,
      tiltDy: placement.tiltDy,
      tiltIntensity: placement.tiltIntensity,
    }

    let result
    if (demoActive) {
      result = await verify({
        stopId,
        latitude: 0,
        longitude: 0,
        stopOpenedAt,
        demo: true,
        placement: placementBody,
      })
    } else {
      const location = await checkLocation()
      result = await verify({
        stopId,
        latitude: location?.latitude ?? 0,
        longitude: location?.longitude ?? 0,
        qrCodeId,
        stopOpenedAt,
        placement: placementBody,
      })
    }

    if (!result?.verified || !result.stamp) {
      Alert.alert(
        'Not quite there',
        result?.reason ?? 'You need to be at the location to stamp.',
      )
      handlePressCancel(pageId, stopId)
      return
    }
    const stampData = result.stamp

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
    setCaptureSheet({ stampId: stampData.id, stopId, redemptionCode })
  }, [userId, collectorPassport, demoActive, checkLocation, verify, handlePressCancel])

  // Placement entry point. QR-verified stops route through the scanner
  // sheet first (real scan, all users — this enables verification, never
  // bypasses it); everything else goes straight to submitStamp. Demo mode
  // skips the scan because the server-authorized demo path skips all
  // verification anyway.
  const handleStampPlaced = useCallback(async (
    pageId: string,
    stopId: string,
    placement: StampPlacement,
  ) => {
    const stop = (stops[pageId] ?? []).find((s) => s.id === stopId)
    if (stop && !demoActive && stopRequiresQr(stop)) {
      const cached = scannedCodes.current[stopId]
      if (cached) {
        await submitStamp(pageId, stopId, placement, cached)
        return
      }
      setPendingScan({ pageId, stopId, stopName: stop.name, placement })
      return
    }
    await submitStamp(pageId, stopId, placement)
  }, [stops, demoActive, submitStamp])

  const handleQrScanned = useCallback(async (qrCodeId: string) => {
    const pending = pendingScan
    setPendingScan(null)
    if (!pending) return
    scannedCodes.current[pending.stopId] = qrCodeId
    await submitStamp(pending.pageId, pending.stopId, pending.placement, qrCodeId)
  }, [pendingScan, submitStamp])

  const handleQrCancelled = useCallback(() => {
    const pending = pendingScan
    setPendingScan(null)
    if (pending) handlePressCancel(pending.pageId, pending.stopId)
  }, [pendingScan, handlePressCancel])

  // (Modal-based overlay callbacks removed in the expressive-gesture PR.
  // The gesture component now delivers placement directly to
  // handleStampPlaced; there is no separate confirmation step.)

  // ── build page sequence ────────────────────────────────────────────────────
  // pageScreenIndex: maps page.id → index in the pages array (of the StopsPage screen index)
  const pageScreenIndex = useMemo(() => {
    const idx: Record<string, number> = {}
    // Screen order: 0=Cover, 1=InsideCover, [2=ToC if enabled], then per page:
    // StopsPage [+ ExitVisa if enabled]. Section dividers were removed.
    const blockSize = prefs.showExitVisa ? 2 : 1
    const firstPage = 2 + (prefs.showToc ? 1 : 0)
    pages.forEach((p, i) => { idx[p.id] = firstPage + i * blockSize })
    return idx
  }, [pages, prefs.showToc, prefs.showExitVisa])

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

    // Table of contents (optional — reader preference)
    if (prefs.showToc) {
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
    }

    // Per DB page: StopsPage [+ ExitVisa]. Section dividers were removed
    // (they rendered as empty intro pages with no content).
    pages.forEach((page, i) => {
      const pageStops = stops[page.id] ?? []
      const pageStamps = stamps[page.id] ?? {}
      const pageSlotStates = slotStates[page.id] ?? {}
      const chapterNum = i + 1

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

      // Exit visa (optional — reader preference; kept for the progress view)
      if (prefs.showExitVisa) {
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
      }
    })

    // Back-pages: private per-stop travel record, appended after the designed
    // pages. Opens with a divider, then ROW-FLOW pages — each stamped stop is
    // one row (chronological by verified_at), rows packed onto the minimum
    // number of pages by estimated height (lib/back-pages-layout). A row is
    // never split across a page. Gated on the reader preference + ≥1 record.
    if (prefs.showBackPages && backPages.length > 0) {
      nodes.push(
        <PassportFrame key="back-cover" bindingSide="left">
          <BackJournalCover count={backPages.length} />
        </PassportFrame>,
      )
      const contentWidth = pageW - BACK_PAGE_PAD_X * 2
      const usableHeight = pageH - BACK_PAGE_PAD_TOP - BACK_PAGE_PAD_BOTTOM
      const packed = packBackPages(backPages, usableHeight, contentWidth)
      packed.forEach((rows, i) => {
        nodes.push(
          <PassportFrame key={`back-${i}`} bindingSide="left">
            <BackJournalPage records={rows} />
          </PassportFrame>,
        )
      })
    }

    return nodes
  }, [
    passport, collectorPassport, bearerName, pages, stops, stamps,
    slotStates, pageScreenIndex, pageW, pageH, prefs.showToc, prefs.showExitVisa,
    prefs.showBackPages, backPages,
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
    <ViewerPrefsContext.Provider value={prefs}>
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
        onPageChange={setNavIdx}
      />

      {/* Page navigation — lives in the bands above/below the page,
          outside the swipe area; complements swipe (does not replace it). */}
      {pageNodes.length > 1 && (
        <View style={navStyles.bar} pointerEvents="box-none">
          <TouchableOpacity
            style={[navStyles.btn, navIdx <= 0 && navStyles.btnDisabled]}
            onPress={() => flipperRef.current?.prev()}
            disabled={navIdx <= 0}
            accessibilityLabel="Previous page"
          >
            <Ionicons name="chevron-back" size={22} color={navIdx <= 0 ? palette.hairline : palette.paper} />
          </TouchableOpacity>

          <Text style={navStyles.indicator}>{navIdx + 1} / {pageNodes.length}</Text>

          <TouchableOpacity
            style={[navStyles.btn, navIdx >= pageNodes.length - 1 && navStyles.btnDisabled]}
            onPress={() => flipperRef.current?.next()}
            disabled={navIdx >= pageNodes.length - 1}
            accessibilityLabel="Next page"
          >
            <Ionicons name="chevron-forward" size={22} color={navIdx >= pageNodes.length - 1 ? palette.hairline : palette.paper} />
          </TouchableOpacity>
        </View>
      )}

      {/* (The pre-stamp modal overlay was removed in the expressive-
          gesture PR — gesture + live preview live in the LocationBox
          itself, see components/stamp/StampGestureInteraction.tsx.) */}

      {/* Post-stamp capture surface — replaces the previous Alert.
          Voice + photo are independently optional. */}
      {userId && (
        <PostStampCaptureSheet
          stampId={captureSheet?.stampId ?? null}
          stopId={captureSheet?.stopId ?? null}
          redemptionCode={captureSheet?.redemptionCode ?? null}
          userId={userId}
          onClose={() => setCaptureSheet(null)}
        />
      )}

      {/* QR-scan-on-press: opens when a placement lands on a QR-verified
          stop. The scanned code feeds the existing verify-stamp QR check —
          this enables real verification, it bypasses nothing. */}
      <QRScanSheet
        stopId={pendingScan?.stopId ?? null}
        stopName={pendingScan?.stopName}
        onScanned={handleQrScanned}
        onCancel={handleQrCancelled}
      />

      {/* Demo banner — intentionally obtrusive; demo stamps must never be
          mistaken for real ones. Shown whenever the (server-authorized)
          demo toggle is active; the toggle itself lives in Profile. */}
      {demoActive && (
        <View pointerEvents="none" style={styles.demoBanner}>
          <Text style={styles.demoBannerText}>DEMO MODE — verification bypassed, stamps marked demo</Text>
        </View>
      )}
    </View>
    </ViewerPrefsContext.Provider>
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
  // ── Demo mode banner ─────────────────────────────────────────────────────
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
})

// ── Correction-notice banner (holder-side) ─────────────────
// Co-located with the screen because it consumes the screen's
// existing supabase client + state. Mirrors the web
// CorrectionNoticeBanner in copy + behavior.
const navStyles = StyleSheet.create({
  bar: {
    // In normal flow directly beneath the page (the screen centers the
    // page + this bar as one group), instead of pinned to the screen bottom.
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  btnDisabled: {
    opacity: 0.4,
  },
  indicator: {
    minWidth: 56,
    textAlign: 'center',
    fontSize: 13,
    color: palette.paper,
    fontVariant: ['tabular-nums'],
  },
})

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
