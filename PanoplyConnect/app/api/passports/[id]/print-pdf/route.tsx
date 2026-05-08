import React from 'react'
import { renderToBuffer, Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'

// ── Layout constants (points: 72pt = 1 inch) ─────────────────────────────────
const SHEET_W = 612   // 8.5 in
const SHEET_H = 792   // 11 in
const SLOT_W  = 612   // full sheet width
const SLOT_H  = 396   // 5.5 in — half of sheet height
const FOLD_X  = 306   // 4.25 in — vertical fold center
const CUT_Y   = 396   // 5.5 in — horizontal cut line / slot boundary
const PAD     = 14    // slot interior padding (~0.2 in)

// ── Styles ────────────────────────────────────────────────────────────────────

const S = StyleSheet.create({

  // Full sheet (PDF page)
  sheet: {
    width: SHEET_W,
    height: SHEET_H,
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },

  // Registration mark pieces — positioned absolutely on the sheet
  regH: { position: 'absolute', height: 0.5, backgroundColor: '#CCCCCC' },
  regV: { position: 'absolute', width: 0.5,  backgroundColor: '#CCCCCC' },

  // Slot divider at cut line
  slotDivider: {
    position: 'absolute',
    left: 0,
    top: CUT_Y,
    width: SHEET_W,
    height: 0.5,
    backgroundColor: '#CCCCCC',
  },

  // Slot: half-sheet container, absolutely positioned on the sheet
  slot: {
    position: 'absolute',
    width: SLOT_W,
    height: SLOT_H,
    overflow: 'hidden',
    flexDirection: 'column',
  },

  // Fold guide — thin vertical line at FOLD_X, spans full slot height
  foldGuide: {
    position: 'absolute',
    left: FOLD_X,
    top: 0,
    width: 0.5,
    height: SLOT_H,
    backgroundColor: '#DDDDDD',
  },

  // Content area inside slot (handles padding)
  slotContent: {
    flex: 1,
    padding: PAD,
    flexDirection: 'column',
    overflow: 'hidden',
  },

  // Page number in bottom-right of each slot
  pgNum: {
    position: 'absolute',
    bottom: PAD,
    right: PAD,
    fontSize: 8,
    color: '#888888',
    fontFamily: 'Helvetica',
  },

  // ── Stop slot ─────────────────────────────────────────────────────────────
  stopHeader: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },

  stampBox: {
    width: 180,
    height: 180,
    borderWidth: 1.5,
    borderColor: '#999999',
    borderStyle: 'solid',
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
    alignSelf: 'center',
    position: 'relative',
    marginVertical: 10,
  },

  stopNameInBox: {
    position: 'absolute',
    bottom: 5,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 7,
    color: '#BBBBBB',
    fontFamily: 'Helvetica',
  },

  journalPrompt: {
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#444444',
    marginBottom: 4,
    marginTop: 4,
  },

  writingLine: {
    height: 0.5,
    backgroundColor: '#CCCCCC',
    marginVertical: 5,
    width: '90%',
    alignSelf: 'center',
  },

  // ── Cover slot ─────────────────────────────────────────────────────────────
  coverInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
  },

  coverTitle: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 6,
  },

  coverSubtitle: {
    fontSize: 11,
    color: '#555555',
    textAlign: 'center',
    marginBottom: 24,
  },

  coverField: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
    width: '85%',
  },

  coverFieldLabel: {
    fontSize: 11,
    color: '#333333',
    marginRight: 6,
    width: 44,
  },

  coverFieldLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: '#CCCCCC',
  },

  // ── Certificate slot ───────────────────────────────────────────────────────
  certInner: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },

  certHeading: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    alignSelf: 'center',
    marginBottom: 6,
  },

  certTitle: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 20,
  },

  certLabel: {
    fontSize: 11,
    color: '#333333',
    marginBottom: 2,
  },

  certLine: {
    height: 0.5,
    backgroundColor: '#CCCCCC',
    marginBottom: 14,
    width: '100%',
  },

  certLineShort: {
    height: 0.5,
    backgroundColor: '#CCCCCC',
    marginBottom: 14,
    width: '55%',
  },

  certMeta: {
    fontSize: 9,
    color: '#666666',
    marginTop: 8,
    alignSelf: 'center',
    textAlign: 'center',
  },

  // ── Assembly instruction page ──────────────────────────────────────────────
  instrPage: {
    width: SHEET_W,
    height: SHEET_H,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 72,
    paddingTop: 60,
    paddingBottom: 48,
    flexDirection: 'column',
  },

  instrBrand: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#222222',
    letterSpacing: 2,
    marginBottom: 16,
  },

  instrDocLabel: {
    fontSize: 11,
    color: '#666666',
    marginBottom: 2,
  },

  instrPassportTitle: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#1A1A1A',
    marginBottom: 4,
  },

  instrInstName: {
    fontSize: 11,
    color: '#555555',
    marginBottom: 4,
  },

  instrMeta: {
    fontSize: 11,
    color: '#888888',
    marginBottom: 24,
  },

  instrRule: {
    height: 0.5,
    backgroundColor: '#CCCCCC',
    marginBottom: 24,
  },

  instrStepRow: {
    flexDirection: 'row',
    marginBottom: 20,
  },

  instrStepNum: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1A1A1A',
    width: 52,
  },

  instrStepBody: {
    flex: 1,
  },

  instrStepTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1A1A1A',
    marginBottom: 2,
  },

  instrStepText: {
    fontSize: 11,
    color: '#555555',
    lineHeight: 1.4,
  },

  instrFooter: {
    marginTop: 'auto',
  },

  instrFooterRule: {
    height: 0.5,
    backgroundColor: '#CCCCCC',
    marginBottom: 12,
  },

  instrFooterText: {
    fontSize: 11,
    color: '#777777',
    textAlign: 'center',
  },
})

// ── Types ─────────────────────────────────────────────────────────────────────

interface PrintStop {
  id: string
  name: string
  stop_order: number
  journal_prompt: string | null
  print_include_journal: boolean
}

type SlotContent =
  | { type: 'cover'; title: string; subtitle: string }
  | { type: 'stop'; stop: PrintStop; index: number; showJournal: boolean }
  | { type: 'cert'; title: string; institutionName: string }
  | { type: 'blank' }

// ── Registration marks: crosshairs at left/right edges of cut line ────────────

function RegistrationMarks() {
  const len  = 16
  const half = len / 2
  const y    = CUT_Y

  return (
    <>
      {/* Left edge crosshair */}
      <View style={[S.regH, { left: 0,            top: y - 0.25,    width: len  }]} />
      <View style={[S.regV, { left: half - 0.25,  top: y - half,    height: len }]} />

      {/* Right edge crosshair */}
      <View style={[S.regH, { left: SHEET_W - len, top: y - 0.25,   width: len  }]} />
      <View style={[S.regV, { left: SHEET_W - half - 0.25, top: y - half, height: len }]} />
    </>
  )
}

// ── Slot content components ───────────────────────────────────────────────────

function CoverSlotContent({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={S.coverInner}>
      <Text style={S.coverTitle}>{title}</Text>
      {subtitle ? <Text style={S.coverSubtitle}>{subtitle}</Text> : null}
      <View style={S.coverField}>
        <Text style={S.coverFieldLabel}>Name:</Text>
        <View style={S.coverFieldLine} />
      </View>
      <View style={S.coverField}>
        <Text style={S.coverFieldLabel}>Date:</Text>
        <View style={S.coverFieldLine} />
      </View>
      <View style={S.coverField}>
        <Text style={S.coverFieldLabel}>Class:</Text>
        <View style={S.coverFieldLine} />
      </View>
    </View>
  )
}

function StopSlotContent({
  stop,
  index,
  showJournal,
}: {
  stop: PrintStop
  index: number
  showJournal: boolean
}) {
  return (
    <>
      <Text style={S.stopHeader}>
        <Text style={{ color: '#888888', fontFamily: 'Helvetica', fontSize: 13 }}>
          {'Stop ' + index + '  '}
        </Text>
        {stop.name}
      </Text>

      {/* Stamp box — blank white interior, stop name at bottom only */}
      <View style={S.stampBox}>
        <Text style={S.stopNameInBox}>{stop.name}</Text>
      </View>

      {showJournal && (
        <>
          {stop.journal_prompt ? (
            <Text style={S.journalPrompt}>{stop.journal_prompt}</Text>
          ) : null}
          <View style={S.writingLine} />
          <View style={S.writingLine} />
          <View style={S.writingLine} />
          <View style={S.writingLine} />
          <View style={S.writingLine} />
        </>
      )}
    </>
  )
}

function CertSlotContent({
  title,
  institutionName,
}: {
  title: string
  institutionName: string
}) {
  return (
    <View style={S.certInner}>
      <Text style={S.certHeading}>Certificate of Completion</Text>
      <Text style={S.certTitle}>{title}</Text>
      <Text style={S.certLabel}>Awarded to:</Text>
      <View style={S.certLine} />
      <Text style={S.certLabel}>Date:</Text>
      <View style={S.certLineShort} />
      <Text style={S.certLabel}>Signed:</Text>
      <View style={S.certLineShort} />
      {institutionName ? <Text style={S.certMeta}>{institutionName}</Text> : null}
    </View>
  )
}

// ── Slot wrapper: fold guide + content + page number ─────────────────────────

function Slot({
  content,
  slotTop,
  pageNum,
}: {
  content: SlotContent
  slotTop: number
  pageNum: number
}) {
  return (
    <View style={[S.slot, { top: slotTop }]}>
      {/* Fold guide — dashed vertical at FOLD_X */}
      <View style={S.foldGuide} />

      {/* Padded content area */}
      <View style={S.slotContent}>
        {content.type === 'cover' && (
          <CoverSlotContent title={content.title} subtitle={content.subtitle} />
        )}
        {content.type === 'stop' && (
          <StopSlotContent
            stop={content.stop}
            index={content.index}
            showJournal={content.showJournal}
          />
        )}
        {content.type === 'cert' && (
          <CertSlotContent
            title={content.title}
            institutionName={content.institutionName}
          />
        )}
        {/* blank: empty — no content */}
      </View>

      {/* Page number — bottom-right of slot */}
      {content.type !== 'blank' && (
        <Text style={S.pgNum}>{pageNum}</Text>
      )}
    </View>
  )
}

// ── Content page: two slots + sheet guides ────────────────────────────────────

function ContentPage({
  topSlot,
  bottomSlot,
  topPageNum,
  bottomPageNum,
}: {
  topSlot: SlotContent
  bottomSlot: SlotContent
  topPageNum: number
  bottomPageNum: number
}) {
  return (
    <Page size={[SHEET_W, SHEET_H]} style={S.sheet}>
      {/* Registration marks at left/right edges of cut line */}
      <RegistrationMarks />

      {/* Slot divider at cut line */}
      <View style={S.slotDivider} />

      {/* Top slot (passport pages 1–2 of this sheet) */}
      <Slot content={topSlot} slotTop={0} pageNum={topPageNum} />

      {/* Bottom slot */}
      <Slot content={bottomSlot} slotTop={CUT_Y} pageNum={bottomPageNum} />
    </Page>
  )
}

// ── Assembly instruction page (PDF page 1) ────────────────────────────────────

function InstructionPage({
  passportTitle,
  institutionName,
  stopCount,
  totalPageCount,
}: {
  passportTitle: string
  institutionName: string
  stopCount: number
  totalPageCount: number
}) {
  const meta =
    stopCount + ' stop' + (stopCount !== 1 ? 's' : '') +
    ' · ' + totalPageCount + ' pages' +
    ' · print as many copies as you need'

  return (
    <Page size={[SHEET_W, SHEET_H]} style={S.instrPage}>
      <Text style={S.instrBrand}>PANOPLY</Text>

      <Text style={S.instrDocLabel}>Print-ready passport booklet</Text>
      <Text style={S.instrPassportTitle}>{passportTitle}</Text>
      {institutionName ? (
        <Text style={S.instrInstName}>{institutionName}</Text>
      ) : null}
      <Text style={S.instrMeta}>{meta}</Text>

      <View style={S.instrRule} />

      <View style={S.instrStepRow}>
        <Text style={S.instrStepNum}>Step 1</Text>
        <View style={S.instrStepBody}>
          <Text style={S.instrStepTitle}>Print double-sided</Text>
          <Text style={S.instrStepText}>
            Set your printer to double-sided, flip on short edge.
          </Text>
        </View>
      </View>

      <View style={S.instrStepRow}>
        <Text style={S.instrStepNum}>Step 2</Text>
        <View style={S.instrStepBody}>
          <Text style={S.instrStepTitle}>Cut</Text>
          <Text style={S.instrStepText}>
            Cut each sheet in half horizontally at the center. The marks on
            the left and right edges show you where.
          </Text>
        </View>
      </View>

      <View style={S.instrStepRow}>
        <Text style={S.instrStepNum}>Step 3</Text>
        <View style={S.instrStepBody}>
          <Text style={S.instrStepTitle}>Stack</Text>
          <Text style={S.instrStepText}>
            Stack all half-sheets in order. Page numbers are in the bottom corner.
          </Text>
        </View>
      </View>

      <View style={S.instrStepRow}>
        <Text style={S.instrStepNum}>Step 4</Text>
        <View style={S.instrStepBody}>
          <Text style={S.instrStepTitle}>Fold and staple</Text>
          <Text style={S.instrStepText}>
            Fold each half-sheet in half vertically. Staple twice along the
            left folded edge.
          </Text>
        </View>
      </View>

      <View style={S.instrRule} />

      <View style={S.instrFooter}>
        <Text style={S.instrFooterText}>
          Students use rubber stamps or stickers in the stamp boxes.
        </Text>
      </View>
    </Page>
  )
}

// ── Main PDF document ─────────────────────────────────────────────────────────

interface PrintPassportDocProps {
  passportTitle: string
  institutionName: string
  stops: PrintStop[]
  journalOverride: 'include_all' | 'exclude_all' | null
}

function PrintPassportDoc({
  passportTitle,
  institutionName,
  stops,
  journalOverride,
}: PrintPassportDocProps) {
  // Build sequential slot list: Cover → Stops → Certificate
  const slots: SlotContent[] = []

  slots.push({ type: 'cover', title: passportTitle, subtitle: institutionName })

  stops.forEach((stop, idx) => {
    const showJournal =
      journalOverride === 'include_all' ? true
      : journalOverride === 'exclude_all' ? false
      : stop.print_include_journal

    slots.push({ type: 'stop', stop, index: idx + 1, showJournal })
  })

  slots.push({ type: 'cert', title: passportTitle, institutionName })

  // Pad to even count so every slot has a partner
  if (slots.length % 2 !== 0) {
    slots.push({ type: 'blank' })
  }

  // Group into content PDF pages (pairs of slots)
  const pages: [SlotContent, SlotContent][] = []
  for (let i = 0; i < slots.length; i += 2) {
    pages.push([slots[i], slots[i + 1]])
  }

  const totalPageCount = 1 + stops.length + 1  // cover + stops + cert

  return (
    <Document>
      {/* Page 1: assembly instructions — not cut or folded */}
      <InstructionPage
        passportTitle={passportTitle}
        institutionName={institutionName}
        stopCount={stops.length}
        totalPageCount={totalPageCount}
      />

      {/* Content pages: sequential imposition, two slots per sheet */}
      {pages.map((pair, pIdx) => (
        <ContentPage
          key={pIdx}
          topSlot={pair[0]}
          bottomSlot={pair[1]}
          topPageNum={pIdx * 2 + 1}
          bottomPageNum={pIdx * 2 + 2}
        />
      ))}
    </Document>
  )
}

// ── Route ─────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    return await handlePrintRequest(request, params.id)
  } catch (err) {
    console.error('[print-pdf] unhandled error:', err)
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }
}

async function handlePrintRequest(request: Request, passportId: string) {
  const supabase = await createClient()

  // ── 1. Auth ──────────────────────────────────────────────────────────────
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── 2. Parse body ────────────────────────────────────────────────────────
  let body: {
    stop_ids: string[]
    copies: number
    journal_override: 'include_all' | 'exclude_all' | null
  }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { stop_ids, copies, journal_override } = body
  if (!Array.isArray(stop_ids) || typeof copies !== 'number') {
    return new Response(JSON.stringify({ error: 'Missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── 3. Fetch passport ────────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: passport, error: passportError } = await (supabase as any)
    .from('passports')
    .select('id, title, creator_id, proprietor_id')
    .eq('id', passportId)
    .single() as { data: { id: string; title: string; creator_id: string; proprietor_id: string | null } | null; error: unknown }

  if (passportError || !passport) {
    return new Response(JSON.stringify({ error: 'Passport not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── 4. Authorize: creator or employee of the owning institution ──────────
  const isCreator = passport.creator_id === user.id
  if (!isCreator) {
    if (!passport.proprietor_id) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to print this passport' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: authz } = await (supabase as any)
      .from('employee_authorizations')
      .select('id')
      .eq('user_id', user.id)
      .eq('institution_id', passport.proprietor_id)
      .maybeSingle()

    if (!authz) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to print this passport' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }

  // ── 5. Institution name (optional — personal passports have no proprietor) ─
  let institutionName = ''
  if (passport.proprietor_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inst } = await (supabase as any)
      .from('institutions')
      .select('name')
      .eq('id', passport.proprietor_id)
      .single() as { data: { name: string } | null }
    institutionName = inst?.name ?? ''
  }

  // ── 6. Fetch stops in the requested order ────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pages, error: pagesErr } = await (supabase as any)
    .from('passport_pages')
    .select('id')
    .eq('passport_id', passportId) as { data: { id: string }[] | null; error: unknown }

  if (pagesErr) {
    return new Response(JSON.stringify({ error: 'Failed to fetch passport pages' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const pageIds = (pages ?? []).map((p: { id: string }) => p.id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stopsRaw, error: stopsErr } = await (supabase as any)
    .from('stops')
    .select('id, name, stop_order, page_id, journal_prompt, print_include_journal')
    .in('id', stop_ids.length > 0 ? stop_ids : ['__none__'])
    .in('page_id', pageIds.length > 0 ? pageIds : ['__none__'])

  if (stopsErr) {
    return new Response(JSON.stringify({ error: 'Failed to fetch stops' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const stopMap = new Map<string, PrintStop>()
  for (const s of (stopsRaw ?? []) as Record<string, unknown>[]) {
    stopMap.set(s.id as string, {
      id:                    s.id as string,
      name:                  s.name as string,
      stop_order:            (s.stop_order as number) ?? 0,
      journal_prompt:        (s.journal_prompt as string | null) ?? null,
      print_include_journal: Boolean(s.print_include_journal ?? false),
    })
  }

  const orderedStops: PrintStop[] = stop_ids
    .map((sid) => stopMap.get(sid))
    .filter((s): s is PrintStop => s !== undefined)

  // ── 7. Render PDF ────────────────────────────────────────────────────────
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderToBuffer(
      <PrintPassportDoc
        passportTitle={passport.title}
        institutionName={institutionName}
        stops={orderedStops}
        journalOverride={journal_override}
      />
    )
  } catch (err) {
    console.error('[print-pdf] renderToBuffer error:', err)
    return new Response(JSON.stringify({ error: 'PDF generation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── 8. Log print job (best-effort — don't fail the request) ─────────────
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('print_jobs').insert({
      passport_id:     passportId,
      institution_id:  passport.proprietor_id ?? null,
      created_by:      user.id,
      stop_ids,
      copies,
      journal_setting: journal_override ?? 'per_stop',
    })
  } catch (err) {
    console.warn('[print-pdf] failed to log print job:', err)
  }

  // ── 9. Return PDF ────────────────────────────────────────────────────────
  const dateStr   = new Date().toISOString().slice(0, 10)
  const safeTitle = passport.title.replace(/[^\w\s-]/g, '').trim()
  const filename  = `${safeTitle} - Print Passport - ${dateStr}.pdf`

  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
