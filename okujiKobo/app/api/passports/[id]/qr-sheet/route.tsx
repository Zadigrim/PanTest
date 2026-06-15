// GET /api/passports/[id]/qr-sheet
//
// Generates a printable PDF of stable QR codes for every QR-verified stop on a
// passport — one labeled code per stop, laid out multiple-per-Letter-page with
// dashed cut borders for sticker paper. The creator prints these and places
// them at the real locations.
//
// SCOPE: the STABLE stop-QR path only (stops.qr_code_id + provision-qr-token).
// Nothing here touches moichido punch QRs or terminal prize codes.
//
// FORMAT: each QR encodes generateQrPayload(stop.id, stop.qr_code_id) — the
// EXACT JSON the mobile scanner (lib/qr.ts parseQrPayload) reads and matches in
// verify-stamp. See lib/qr-payload.ts for the drift-guard note.
//
// PROVISIONING: any qualifying stop missing a qr_code_id is provisioned via the
// canonical provision-qr-token edge function (no parallel mechanism).
//
// GATING: creator / platform-admin / can_design at the proprietor — the same
// gate provision-qr-token enforces.
import { NextRequest, NextResponse } from 'next/server'
import {
  renderToBuffer, Document, Page, View, Text, Image, StyleSheet,
} from '@react-pdf/renderer'
import QRCode from 'qrcode'
import { createClient } from '@/lib/supabase/server'
import { generateQrPayload } from '@/lib/qr-payload'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Mirror of the mobile stopRequiresQr predicate (app/passport/[id].tsx):
// canonical experience_verification_method === 'qr', with verification_tier /
// legacy evidence_tier IN (1,2) as the pre-046 fallback. GPS-only (tier 3) and
// honor (tier 5) are excluded.
interface StopRow {
  id: string
  name: string | null
  qr_code_id: string | null
  experience_verification_method: string | null
  verification_tier: number | null
  evidence_tier: number | null
}
function stopRequiresQr(s: StopRow): boolean {
  if (s.experience_verification_method != null) {
    return s.experience_verification_method === 'qr'
  }
  const tier = s.verification_tier ?? s.evidence_tier ?? 5
  return tier === 1 || tier === 2
}

const styles = StyleSheet.create({
  page: { padding: 36, fontFamily: 'Helvetica' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  // 2 columns × 4 rows = 8 per Letter page. Dashed border = cut line.
  card: {
    width: '50%',
    height: 174,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    border: '1pt dashed #999999',
  },
  passport: { fontSize: 8, color: '#6B6356', textAlign: 'center' },
  stop: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#1F1D1A', textAlign: 'center', marginTop: 2 },
  qr: { width: 96, height: 96, marginVertical: 6 },
  wm: { fontSize: 11, color: '#1D4D2E', letterSpacing: 0.5 },
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any

  // ── Passport + authorize (creator / admin / can_design) ──
  const { data: passport } = await db
    .from('passports')
    .select('title, creator_id, proprietor_id')
    .eq('id', id)
    .single()
  if (!passport) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let authorized = passport.creator_id === user.id
  if (!authorized) {
    const { data: prof } = await db.from('profiles').select('is_platform_admin').eq('id', user.id).maybeSingle()
    authorized = prof?.is_platform_admin === true
  }
  if (!authorized && passport.proprietor_id) {
    const { data: authz } = await db
      .from('employee_authorizations')
      .select('can_design')
      .eq('user_id', user.id)
      .eq('institution_id', passport.proprietor_id)
      .maybeSingle()
    authorized = authz?.can_design === true
  }
  if (!authorized) return NextResponse.json({ error: 'Not authorized' }, { status: 403 })

  // ── Qualifying stops (QR-verified), in page/stop order ──
  const { data: pages } = await db
    .from('passport_pages')
    .select('id, page_order')
    .eq('passport_id', id)
    .is('closed_at', null)
    .order('page_order', { ascending: true })
  const pageIds = (pages ?? []).map((p: { id: string }) => p.id)

  const { data: rawStops } = pageIds.length
    ? await db
        .from('stops')
        .select('id, name, qr_code_id, experience_verification_method, verification_tier, evidence_tier, page_id, stop_order')
        .in('page_id', pageIds)
        .order('stop_order', { ascending: true })
    : { data: [] }

  const qualifying: StopRow[] = (rawStops ?? []).filter(stopRequiresQr)
  if (qualifying.length === 0) {
    return NextResponse.json({ error: 'This passport has no QR-verified stops.' }, { status: 400 })
  }

  // ── Provision any missing qr_code_id via the canonical edge function ──
  for (const stop of qualifying) {
    if (stop.qr_code_id) continue
    const { data: prov, error } = await supabase.functions.invoke('provision-qr-token', {
      body: { stopId: stop.id },
    })
    if (!error && prov?.token) stop.qr_code_id = prov.token as string
    else console.error('[qr-sheet] provision failed for stop', stop.id, error)
  }

  const withTokens = qualifying.filter((s) => !!s.qr_code_id)
  if (withTokens.length === 0) {
    return NextResponse.json({ error: 'Could not provision QR tokens.' }, { status: 500 })
  }

  // ── QR data URLs (encode the exact mobile-scanner payload) ──
  const cards = await Promise.all(
    withTokens.map(async (s) => ({
      stopName: s.name ?? 'Stop',
      dataUrl: await QRCode.toDataURL(generateQrPayload(s.id, s.qr_code_id as string), {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 480,
      }),
    })),
  )

  const title: string = passport.title ?? 'Passport'

  const buffer = await renderToBuffer(
    <Document title={`${title} — QR codes`}>
      <Page size="LETTER" style={styles.page} wrap>
        <View style={styles.grid}>
          {cards.map((c, i) => (
            <View key={i} style={styles.card} wrap={false}>
              <Text style={styles.passport}>{title}</Text>
              <Text style={styles.stop}>{c.stopName}</Text>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image style={styles.qr} src={c.dataUrl} />
              <Text style={styles.wm}>okuji</Text>
            </View>
          ))}
        </View>
      </Page>
    </Document>,
  )

  const safeName = title.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'passport'
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${safeName}-qr-codes.pdf"`,
    },
  })
}
