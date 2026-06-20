import React from 'react'
import {
  renderToBuffer, Document, Page, View, Text, StyleSheet, Image,
} from '@react-pdf/renderer'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/types'
import { normalizeImage, rasterizeSvg } from '@/lib/print/normalize-images'
import {
  PAGE_TRIM_W_PT, PAGE_TRIM_H_PT, PAGE_FULL_W_PT, PAGE_FULL_H_PT, BLEED_PT,
} from '@/lib/print/passport-spec'

// ── Journey keepsake generator ────────────────────────────────────────────────
//
// Produces a print-ready PDF KEEPSAKE of ONE tester's COMPLETED journey:
// their REAL stamps + journal entries + photos, organized chronologically as
// the trip they took. One "moment" per stamped stop = the earned stamp + the
// place + date/time + journal text + photo(s), in verified_at order.
//
// This is DISTINCT from the blank print-PDF at /api/passports/[id]/print-pdf
// (the booklet a collector prints to stamp into). That route is not touched.
//
// TWO HARD GATES, both required:
//   1. is_platform_admin() — only a platform admin may run this. A keepsake
//      reproduces another person's PRIVATE journal/photos in print, so it is
//      never a collector-facing self-serve export.
//   2. profiles.keepsake_consent_at IS NOT NULL — the target tester must have
//      explicitly opted in (migration 101). No consent → the generator
//      REFUSES (403). Never a silent export of a private journal.
//
// Theme (ruling 5 = A): each moment carries the PASSPORT'S OWN page background
// — a Port Orchard keepsake feels like Port Orchard, the way the tester
// remembered it while collecting. Every stamped stop becomes a moment
// (ruling 6 = A) — no compression, no gaps in their memory. Trim = passport
// trim 88×125 mm + 3 mm bleed (ruling 8), reusing passport-spec directly so
// themed art maps 1:1.

export const dynamic = 'force-dynamic'
// sharp (lib/print/normalize-images) needs the Node runtime; Edge would crash
// on the native binding.
export const runtime = 'nodejs'

// Cap on resolved photos per moment — matches the mobile back-pages contract
// (hooks/useBackPages MAX_PHOTOS_PER_STOP) so the keepsake shows the same set
// the tester saw in-app, and one heavy entry can't fan out into dozens of
// signed-URL calls.
const MAX_PHOTOS_PER_MOMENT = 3
// Signed-URL lifetime for private journal photos — long enough to fetch every
// photo during this one render, then it expires.
const SIGNED_TTL_SECONDS = 600
// Stamp resample cap (px). A stamp prints under an inch; a PNG is fully decoded
// (+ SMask) by pdfkit at render, so keep it small.
const STAMP_MAX_DIMENSION = 384
// A printed photo wants ~300 dpi. At the keepsake's ~70 mm photo width that's
// ~825 px; below this the photo would visibly soften if blown to full width,
// so we render it at its honest size and flag it rather than upscaling (sharp
// never enlarges — withoutEnlargement — so it can only ever look soft, never
// pixel-stretched).
const LOW_RES_MIN_DIM = 800

// ── Twemoji (emoji stamps) ────────────────────────────────────────────────────
// @react-pdf's fonts have no emoji glyphs; map an emoji stamp to its Twemoji
// PNG and run it through the same normalize pass as a raster stamp.
const TWEMOJI_BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/72x72'
function twemojiPngUrl(emoji: string | null | undefined): string | null {
  if (!emoji) return null
  const cps: string[] = []
  for (const ch of emoji) {
    const cp = ch.codePointAt(0)
    if (cp !== undefined) cps.push(cp.toString(16))
  }
  if (cps.length === 0) return null
  const name = (cps.length > 1 ? cps.filter((c) => c !== 'fe0f') : cps).join('-')
  return `${TWEMOJI_BASE}/${name}.png`
}

// ── Service-role client ────────────────────────────────────────────────────────
// The journey reads cross-user data (the target tester's stamps/journal/photos)
// and signs private storage URLs — both beyond the caller's own RLS scope. The
// admin + consent gates above are what authorize it; the service role only ever
// runs AFTER both pass.
function createServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => [], setAll: () => {} } },
  )
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// ── Data shapes ────────────────────────────────────────────────────────────────
interface MomentPhoto {
  /** Final embeddable data: URI (normalized JPEG), or null if it failed. */
  src: string | null
  /** True when the source pixels are below print resolution for full width —
   *  rendered at honest size with a quiet note, never upscaled. */
  lowRes: boolean
}
interface Moment {
  stopName: string
  verifiedAt: string
  journalBody: string | null
  /** Final embeddable stamp data: URI (PNG/JPEG), or null → no stamp art. */
  stampSrc: string | null
  photos: MomentPhoto[]
  /** Theme: the page this stop sits on (ruling 5 = A, themed by passport). */
  paperColorHex: string
  bgImageSrc: string | null
  bgOpacity: number
}

// ── Render ──────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  // Each moment is a full trim+bleed leaf themed by its page.
  title: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#1A1A1A', textAlign: 'center' },
  titleSub: { fontSize: 11, fontFamily: 'Helvetica', color: '#333333', textAlign: 'center', marginTop: 10 },
  titleMeta: { fontSize: 9, fontFamily: 'Helvetica-Oblique', color: '#666666', textAlign: 'center', marginTop: 6 },
  momentHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  stampBox: { width: 48, height: 48, marginRight: 10, alignItems: 'center', justifyContent: 'center' },
  place: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#1A1A1A' },
  when: { fontSize: 8, fontFamily: 'Helvetica', color: '#555555', marginTop: 2 },
  body: { fontSize: 9.5, fontFamily: 'Helvetica', color: '#222222', lineHeight: 1.4, marginBottom: 8 },
  photo: { width: '100%', marginBottom: 6, objectFit: 'contain' },
  lowResNote: { fontSize: 6, fontFamily: 'Helvetica-Oblique', color: '#999999', textAlign: 'center', marginBottom: 6 },
  emptyNote: { fontSize: 8, fontFamily: 'Helvetica-Oblique', color: '#999999' },
  pageNum: { position: 'absolute', bottom: BLEED_PT + 6, left: BLEED_PT, right: BLEED_PT, textAlign: 'center', fontSize: 6, fontFamily: 'Helvetica', color: '#AAAAAA' },
})

function formatWhen(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function TitlePage({ title, collectorName, range, paperColorHex, bgImageSrc }: {
  title: string; collectorName: string; range: string; paperColorHex: string; bgImageSrc: string | null
}) {
  return (
    <Page size={[PAGE_FULL_W_PT, PAGE_FULL_H_PT]} style={{ backgroundColor: paperColorHex }}>
      {bgImageSrc && (
        <Image src={bgImageSrc} style={{ position: 'absolute', top: 0, left: 0, width: PAGE_FULL_W_PT, height: PAGE_FULL_H_PT, objectFit: 'cover', opacity: 0.85 }} />
      )}
      <View style={{ position: 'absolute', left: BLEED_PT, top: BLEED_PT, width: PAGE_TRIM_W_PT, height: PAGE_TRIM_H_PT, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={S.title}>{title}</Text>
        {collectorName ? <Text style={S.titleSub}>A journey kept by {collectorName}</Text> : null}
        {range ? <Text style={S.titleMeta}>{range}</Text> : null}
      </View>
    </Page>
  )
}

function MomentPage({ moment, index, total }: { moment: Moment; index: number; total: number }) {
  return (
    <Page size={[PAGE_FULL_W_PT, PAGE_FULL_H_PT]} style={{ backgroundColor: moment.paperColorHex }}>
      {moment.bgImageSrc && (
        <Image src={moment.bgImageSrc} style={{ position: 'absolute', top: 0, left: 0, width: PAGE_FULL_W_PT, height: PAGE_FULL_H_PT, objectFit: 'cover', opacity: moment.bgOpacity }} />
      )}
      <View style={{ position: 'absolute', left: BLEED_PT, top: BLEED_PT, width: PAGE_TRIM_W_PT, height: PAGE_TRIM_H_PT, padding: 16 }}>
        <View style={S.momentHeader}>
          <View style={S.stampBox}>
            {moment.stampSrc ? <Image src={moment.stampSrc} style={{ width: 48, height: 48, objectFit: 'contain' }} /> : null}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={S.place}>{moment.stopName}</Text>
            {moment.verifiedAt ? <Text style={S.when}>{formatWhen(moment.verifiedAt)}</Text> : null}
          </View>
        </View>
        {moment.journalBody ? <Text style={S.body}>{moment.journalBody}</Text> : null}
        {moment.photos.map((p, i) =>
          p.src ? (
            <React.Fragment key={i}>
              <Image src={p.src} style={S.photo} />
              {p.lowRes && <Text style={S.lowResNote}>photo shown at its original resolution</Text>}
            </React.Fragment>
          ) : null,
        )}
        {!moment.journalBody && moment.photos.every((p) => !p.src) && (
          <Text style={S.emptyNote}>You were here.</Text>
        )}
      </View>
      <Text style={S.pageNum}>{index + 1} of {total}</Text>
    </Page>
  )
}

function KeepsakeDoc({ title, collectorName, range, moments, titlePaper, titleBg }: {
  title: string; collectorName: string; range: string; moments: Moment[]
  titlePaper: string; titleBg: string | null
}) {
  return (
    <Document>
      <TitlePage title={title} collectorName={collectorName} range={range} paperColorHex={titlePaper} bgImageSrc={titleBg} />
      {moments.map((m, i) => <MomentPage key={i} moment={m} index={i} total={moments.length} />)}
    </Document>
  )
}

// ── Route ──────────────────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    return await handle(request)
  } catch (err) {
    console.error('[keepsake] unhandled error:', err)
    return json({ error: err instanceof Error ? err.message : 'Internal server error' }, 500)
  }
}

async function handle(request: Request) {
  // ── Body ──
  let userId = ''
  let passportId = ''
  try {
    const body = await request.json()
    userId = String((body as { userId?: unknown })?.userId ?? '')
    passportId = String((body as { passportId?: unknown })?.passportId ?? '')
  } catch { /* fall through to validation */ }
  if (!userId || !passportId) {
    return json({ error: 'userId and passportId are required' }, 400)
  }

  // ── Gate 1: caller must be a platform admin ──
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return json({ error: 'Unauthorized' }, 401)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: isAdmin } = await (supabase as any).rpc('is_platform_admin')
  if (isAdmin !== true) return json({ error: 'Admin only' }, 403)

  const admin = createServiceClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  // ── Gate 2: target tester must have opted in ──
  const { data: profile } = await db
    .from('profiles')
    .select('display_name, keepsake_consent_at')
    .eq('id', userId)
    .maybeSingle()
  if (!profile) return json({ error: 'Tester not found' }, 404)
  if (!profile.keepsake_consent_at) {
    // The hard refusal: no opt-in, no keepsake of a private journal.
    return json({ error: 'This tester has not opted in to a printed keepsake. No keepsake can be generated.' }, 403)
  }
  const collectorName = (profile.display_name as string | null)?.trim() ?? ''

  // ── The tester's copy of this passport ──
  const { data: cp } = await db
    .from('collector_passports')
    .select('id')
    .eq('user_id', userId)
    .eq('passport_id', passportId)
    .maybeSingle()
  if (!cp) return json({ error: 'This tester does not hold this passport' }, 404)
  const collectorPassportId = cp.id as string

  // ── Passport (title + cover theme for the title page) ──
  const { data: passport } = await db
    .from('passports')
    .select('id, title, cover_paper_color, cover_outside_data')
    .eq('id', passportId)
    .maybeSingle()
  if (!passport) return json({ error: 'Passport not found' }, 404)
  const titlePaper = `#${(passport.cover_paper_color ?? 'F5F2EC').replace(/^#/, '')}`

  // ── Pages (theme source — ruling 5 = A, themed by passport) ──
  const { data: pagesRaw } = await db
    .from('passport_pages')
    .select('id, paper_color, background_type, background_image_url, custom_background_opacity')
    .eq('passport_id', passportId)
  type PageTheme = { paperHex: string; bgImageUrl: string | null; bgOpacity: number }
  const themeByPage = new Map<string, PageTheme>()
  for (const p of (pagesRaw ?? []) as Array<{ id: string; paper_color: string | null; background_type: string | null; background_image_url: string | null; custom_background_opacity: number | null }>) {
    const hasImage = (p.background_type === 'custom' || p.background_type === 'okuji') && !!p.background_image_url
    themeByPage.set(p.id, {
      paperHex: (p.paper_color ?? 'F5F2EC').replace(/^#/, ''),
      bgImageUrl: hasImage ? p.background_image_url : null,
      bgOpacity: Math.min(100, Math.max(10, p.custom_background_opacity ?? 100)) / 100,
    })
  }
  const pageIds = [...themeByPage.keys()]

  // ── Stamps = the moments (verified_at order). Scoped to THIS tester's copy. ──
  const { data: stamps } = await db
    .from('stamps')
    .select('id, stop_id, verified_at')
    .eq('user_id', userId)
    .eq('collector_passport_id', collectorPassportId)
  const stampRows = (stamps ?? []) as Array<{ id: string; stop_id: string; verified_at: string }>
  if (stampRows.length === 0) {
    return json({ error: 'This tester has no stamps in this passport yet — nothing to keep.' }, 409)
  }

  const stopIds = [...new Set(stampRows.map((s) => s.stop_id))]
  const { data: stopDetail } = await db
    .from('stops')
    .select('id, page_id, name, stamp_type, stamp_color, stamp_asset_id, stamp_icon')
    .in('id', stopIds)
  type StopRow = { id: string; page_id: string; name: string; stamp_type: string | null; stamp_color: string | null; stamp_asset_id: string | null; stamp_icon: string | null }
  const stopById = new Map<string, StopRow>()
  for (const s of (stopDetail ?? []) as StopRow[]) stopById.set(s.id, s)

  // ── Journal entries for these stamps ──
  const stampIds = stampRows.map((s) => s.id)
  const { data: entries } = await db
    .from('journal_entries')
    .select('id, stamp_id, body')
    .in('stamp_id', stampIds)
  const entryByStamp = new Map<string, { id: string; body: string | null }>()
  for (const e of (entries ?? []) as Array<{ id: string; stamp_id: string; body: string | null }>) {
    entryByStamp.set(e.stamp_id, { id: e.id, body: e.body ?? null })
  }

  // ── Uploaded photos for those entries (with stored dims for the low-res flag) ──
  const entryIds = [...entryByStamp.values()].map((e) => e.id)
  const photosByEntry = new Map<string, Array<{ storage_path: string; width: number | null; height: number | null }>>()
  if (entryIds.length > 0) {
    const { data: photoRows } = await db
      .from('journal_photos')
      .select('journal_entry_id, storage_path, status, width_after, height_after, created_at')
      .in('journal_entry_id', entryIds)
      .eq('status', 'uploaded')
      .order('created_at', { ascending: true })
    for (const row of (photoRows ?? []) as Array<{ journal_entry_id: string; storage_path: string | null; width_after: number | null; height_after: number | null }>) {
      if (!row.storage_path) continue
      const list = photosByEntry.get(row.journal_entry_id) ?? []
      if (list.length >= MAX_PHOTOS_PER_MOMENT) continue
      list.push({ storage_path: row.storage_path, width: row.width_after, height: row.height_after })
      photosByEntry.set(row.journal_entry_id, list)
    }
  }

  // ── Resolve custom-asset stamp art (URL + SVG content) ──
  const assetIds = [...new Set(
    stopIds
      .map((id) => stopById.get(id))
      .filter((s): s is StopRow => !!s && s.stamp_type === 'custom_asset' && !!s.stamp_asset_id)
      .map((s) => s.stamp_asset_id as string),
  )]
  const assetById = new Map<string, { url: string | null; file_format: string | null }>()
  if (assetIds.length > 0) {
    const { data: assetRows } = await db
      .from('design_assets')
      .select('id, url, file_format')
      .in('id', assetIds)
    for (const a of (assetRows ?? []) as Array<{ id: string; url: string | null; file_format: string | null }>) {
      assetById.set(a.id, { url: a.url, file_format: a.file_format })
    }
  }
  // Fetch SVG bodies once per URL.
  const svgByUrl = new Map<string, string>()
  await Promise.all(
    [...assetById.values()]
      .filter((a) => a.url && (a.file_format === 'image/svg+xml' || a.url.toLowerCase().split('?')[0].endsWith('.svg')))
      .map(async (a) => {
        try {
          const res = await fetch(a.url as string)
          if (res.ok) svgByUrl.set(a.url as string, await res.text())
        } catch { /* missing stamp degrades to no art */ }
      }),
  )

  // ── Assemble + sort moments (verified_at ascending — the trip in order) ──
  const ordered = [...stampRows].sort(
    (a, b) => new Date(a.verified_at).getTime() - new Date(b.verified_at).getTime(),
  )

  const moments: Moment[] = []
  for (const stamp of ordered) {
    const stop = stopById.get(stamp.stop_id)
    if (!stop) continue
    const theme = themeByPage.get(stop.page_id) ?? { paperHex: 'F5F2EC', bgImageUrl: null, bgOpacity: 1 }
    const entry = entryByStamp.get(stamp.id)
    const photoMeta = entry ? (photosByEntry.get(entry.id) ?? []) : []

    // Stamp art — same resolution rules as the print route.
    let stampSrc: string | null = null
    if (stop.stamp_type === 'custom_asset' && stop.stamp_asset_id) {
      const asset = assetById.get(stop.stamp_asset_id)
      const svg = asset?.url ? svgByUrl.get(asset.url) : undefined
      if (svg) {
        const recolored = svg.replace(/currentColor/g, `#${(stop.stamp_color ?? '1D9E75').replace(/^#/, '')}`)
        stampSrc = await rasterizeSvg(recolored, STAMP_MAX_DIMENSION)
      } else if (asset?.url) {
        stampSrc = await normalizeImage(asset.url, { paperHex: theme.paperHex, preserveAlpha: true, maxDimension: STAMP_MAX_DIMENSION })
      }
    } else if (stop.stamp_type === 'emoji' || (!stop.stamp_type && stop.stamp_icon)) {
      const u = twemojiPngUrl(stop.stamp_icon)
      if (u) stampSrc = await normalizeImage(u, { paperHex: theme.paperHex, preserveAlpha: true, maxDimension: STAMP_MAX_DIMENSION })
    }

    // Background art — themed by the page (ruling 5 = A).
    let bgImageSrc: string | null = null
    if (theme.bgImageUrl) {
      bgImageSrc = await normalizeImage(theme.bgImageUrl, { paperHex: theme.paperHex })
    }

    // Photos — sign each private URL, normalize, flag (never upscale) low-res.
    const photos: MomentPhoto[] = []
    for (const pm of photoMeta) {
      const { data: signed } = await admin.storage.from('journal-photos').createSignedUrl(pm.storage_path, SIGNED_TTL_SECONDS)
      const src = signed?.signedUrl ? await normalizeImage(signed.signedUrl, { paperHex: theme.paperHex }) : null
      const maxDim = Math.max(pm.width ?? 0, pm.height ?? 0)
      photos.push({ src, lowRes: maxDim > 0 && maxDim < LOW_RES_MIN_DIM })
    }

    moments.push({
      stopName: stop.name,
      verifiedAt: stamp.verified_at,
      journalBody: entry?.body ?? null,
      stampSrc,
      photos,
      paperColorHex: `#${theme.paperHex}`,
      bgImageSrc,
      bgOpacity: theme.bgOpacity,
    })
  }

  if (moments.length === 0) {
    return json({ error: 'No stamped stops resolved to a place — nothing to keep.' }, 409)
  }

  // Title-page theme: the passport's first page, falling back to its cover paper.
  const firstTheme = pageIds.length > 0 ? themeByPage.get(pageIds[0]) : undefined
  const titleBg = firstTheme?.bgImageUrl
    ? await normalizeImage(firstTheme.bgImageUrl, { paperHex: firstTheme.paperHex })
    : null

  // Journey date range, from the real first/last stamps.
  const first = ordered[0]?.verified_at
  const last = ordered[ordered.length - 1]?.verified_at
  const fmtDate = (iso: string) => {
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }
  const firstStr = first ? fmtDate(first) : ''
  const lastStr = last ? fmtDate(last) : ''
  const range = firstStr && lastStr && firstStr !== lastStr ? `${firstStr} – ${lastStr}` : firstStr

  // ── Render ──
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderToBuffer(
      <KeepsakeDoc
        title={passport.title as string}
        collectorName={collectorName}
        range={range}
        moments={moments}
        titlePaper={titlePaper}
        titleBg={titleBg}
      />,
    )
  } catch (err) {
    console.error('[keepsake] renderToBuffer error:', err)
    return json({ error: 'Keepsake generation failed' }, 500)
  }

  const dateStr = new Date().toISOString().slice(0, 10)
  const safeTitle = String(passport.title ?? 'Keepsake').replace(/[^\w\s-]/g, '').trim() || 'Keepsake'
  const filename = `${safeTitle} - Journey Keepsake - ${dateStr}.pdf`
  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
