import React from 'react'
import { renderToBuffer, Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'

// ---------------------------------------------------------------------------
// Dimension constants (1pt = 1/72 inch)
// ---------------------------------------------------------------------------
const PAGE_W = 612   // 8.5 inches
const PAGE_H = 792   // 11 inches
const QP_W = 306     // 4.25 inches
const QP_H = 396     // 5.5 inches

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Full page
  fullPage: {
    width: PAGE_W,
    height: PAGE_H,
    backgroundColor: '#FFFFFF',
  },

  // ── Instruction page ──────────────────────────────────────────────────────
  instructionPage: {
    width: PAGE_W,
    height: PAGE_H,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 72,
    paddingVertical: 60,
    flexDirection: 'column',
    alignItems: 'center',
  },
  instrTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#0D1B2A',
    marginBottom: 8,
    textAlign: 'center',
  },
  instrSubtitle: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 32,
  },
  stepContainer: {
    width: '100%',
    marginBottom: 28,
    alignItems: 'center',
  },
  stepLabel: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#1D9E75',
    letterSpacing: 1.5,
    marginBottom: 6,
    textAlign: 'center',
  },
  stepText: {
    fontSize: 12,
    color: '#0D1B2A',
    textAlign: 'center',
    marginBottom: 12,
  },
  diagramBox: {
    border: '1 solid #E8EEF0',
    backgroundColor: '#F7F9F8',
    borderRadius: 4,
    padding: 12,
    width: 220,
    alignItems: 'center',
  },
  diagramLabel: {
    fontSize: 9,
    color: '#64748B',
    textAlign: 'center',
  },
  diagramRect: {
    width: 80,
    height: 56,
    border: '1.5 solid #0D1B2A',
    borderRadius: 2,
    marginBottom: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  diagramRectLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#0D1B2A',
    textAlign: 'center',
  },
  diagramRow: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    marginBottom: 6,
  },
  crossLine: {
    width: 80,
    height: 56,
    border: '1.5 solid #0D1B2A',
    borderRadius: 2,
    marginBottom: 6,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instrFooter: {
    marginTop: 'auto',
    borderTop: '0.5 solid #E8EEF0',
    paddingTop: 12,
    width: '100%',
  },
  instrFooterText: {
    fontSize: 8,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 1.4,
  },
  stepDivider: {
    width: '100%',
    height: 0.5,
    backgroundColor: '#E8EEF0',
    marginBottom: 28,
  },

  // ── Imposition / content page ─────────────────────────────────────────────
  contentPage: {
    width: PAGE_W,
    height: PAGE_H,
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },
  quarterCell: {
    position: 'absolute',
    width: QP_W,
    height: QP_H,
    overflow: 'hidden',
  },

  // ── Registration mark lines ───────────────────────────────────────────────
  regH: {
    position: 'absolute',
    height: 0.5,
    backgroundColor: '#CCCCCC',
    opacity: 0.3,
  },
  regV: {
    position: 'absolute',
    width: 0.5,
    backgroundColor: '#CCCCCC',
    opacity: 0.3,
  },

  // ── Cover quarter-page ────────────────────────────────────────────────────
  coverRoot: {
    width: QP_W,
    height: QP_H,
    backgroundColor: '#FFFFFF',
    padding: 16,
    flexDirection: 'column',
  },
  coverTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#0D1B2A',
    textAlign: 'center',
    marginBottom: 4,
  },
  coverInstitution: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 12,
  },
  coverImageArea: {
    backgroundColor: '#E8E8E8',
    borderRadius: 4,
    flex: 1,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverEmblem: {
    fontSize: 48,
    textAlign: 'center',
  },
  coverFieldRow: {
    marginBottom: 6,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  coverFieldLabel: {
    fontSize: 12,
    color: '#0D1B2A',
    marginRight: 4,
    width: 44,
  },
  coverFieldLine: {
    flex: 1,
    height: 0.75,
    backgroundColor: '#0D1B2A',
    marginBottom: 2,
  },

  // ── Stop quarter-page ─────────────────────────────────────────────────────
  stopRoot: {
    width: QP_W,
    height: QP_H,
    backgroundColor: '#FFFFFF',
    padding: 12,
    flexDirection: 'column',
  },
  stopHeader: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#0D1B2A',
    marginBottom: 6,
  },
  stopRule: {
    width: '100%',
    height: 0.5,
    backgroundColor: '#0D1B2A',
    marginBottom: 8,
  },
  stampBoxOuter: {
    alignSelf: 'center',
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: '#AAAAAA',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  stampBoxInner: {
    position: 'absolute',
    top: 4,
    left: 4,
    borderRadius: 4,
    borderWidth: 0.5,
    borderColor: '#AAAAAA',
  },
  stampBoxName: {
    fontSize: 9,
    color: '#AAAAAA',
    textAlign: 'center',
    position: 'absolute',
    bottom: 6,
    left: 0,
    right: 0,
  },
  journalPrompt: {
    fontSize: 12,
    color: '#0D1B2A',
    marginTop: 8,
    marginBottom: 6,
    lineHeight: 1.3,
  },
  writingLine: {
    width: '100%',
    height: 0.75,
    backgroundColor: '#AAAAAA',
    marginBottom: 14,
  },

  // ── Certificate quarter-page ──────────────────────────────────────────────
  certRoot: {
    width: QP_W,
    height: QP_H,
    backgroundColor: '#FFFFFF',
    padding: 24,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  certHeading: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#64748B',
    textAlign: 'center',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  certTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: '#0D1B2A',
    textAlign: 'center',
    marginBottom: 24,
  },
  certLabel: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 4,
  },
  certLine: {
    width: 180,
    height: 0.75,
    backgroundColor: '#0D1B2A',
    marginBottom: 20,
  },
  certInstName: {
    fontSize: 10,
    color: '#64748B',
    textAlign: 'center',
    marginTop: 4,
  },

  // ── Blank quarter-page ────────────────────────────────────────────────────
  blankRoot: {
    width: QP_W,
    height: QP_H,
    backgroundColor: '#FFFFFF',
  },
})

// ---------------------------------------------------------------------------
// Quarter-page components
// ---------------------------------------------------------------------------

interface CoverProps {
  passportTitle: string
  institutionName: string
  coverEmblem?: string | null
}

function CoverQuarter({ passportTitle, institutionName, coverEmblem }: CoverProps) {
  return (
    <View style={styles.coverRoot}>
      <Text style={styles.coverTitle}>{passportTitle}</Text>
      <Text style={styles.coverInstitution}>{institutionName}</Text>
      <View style={styles.coverImageArea}>
        {coverEmblem ? (
          <Text style={styles.coverEmblem}>{coverEmblem}</Text>
        ) : null}
      </View>
      <View style={styles.coverFieldRow}>
        <Text style={styles.coverFieldLabel}>Name:</Text>
        <View style={styles.coverFieldLine} />
      </View>
      <View style={styles.coverFieldRow}>
        <Text style={styles.coverFieldLabel}>Date:</Text>
        <View style={styles.coverFieldLine} />
      </View>
      <View style={styles.coverFieldRow}>
        <Text style={styles.coverFieldLabel}>Class:</Text>
        <View style={styles.coverFieldLine} />
      </View>
    </View>
  )
}

interface PrintStop {
  id: string
  name: string
  stop_order: number
  journal_prompt: string | null
  print_include_journal: boolean
}

interface StopProps {
  stop: PrintStop
  index: number
  showJournal: boolean
}

function StopQuarter({ stop, index, showJournal }: StopProps) {
  // Stamp box: 202×202 normally; expand to 202×250 if no journal
  const boxW = 202
  const boxH = showJournal ? 202 : 250

  return (
    <View style={styles.stopRoot}>
      <Text style={styles.stopHeader}>{index}  {stop.name}</Text>
      <View style={styles.stopRule} />

      {/* Stamp box — outer border */}
      <View
        style={[
          styles.stampBoxOuter,
          { width: boxW, height: boxH },
        ]}
      >
        {/* Inner border (4pt inset on each side) */}
        <View
          style={[
            styles.stampBoxInner,
            { width: boxW - 8, height: boxH - 8 },
          ]}
        />
        {/* Stop name at bottom */}
        <Text style={styles.stampBoxName}>{stop.name}</Text>
      </View>

      {showJournal && (
        <>
          {stop.journal_prompt ? (
            <Text style={styles.journalPrompt}>{stop.journal_prompt}</Text>
          ) : null}
          <View style={{ marginTop: stop.journal_prompt ? 0 : 8, flex: 1, justifyContent: 'flex-end', paddingBottom: 4 }}>
            <View style={styles.writingLine} />
            <View style={styles.writingLine} />
            <View style={styles.writingLine} />
            <View style={styles.writingLine} />
          </View>
        </>
      )}
    </View>
  )
}

interface CertProps {
  passportTitle: string
  institutionName: string
}

function CertQuarter({ passportTitle, institutionName }: CertProps) {
  return (
    <View style={styles.certRoot}>
      <Text style={styles.certHeading}>CERTIFICATE OF COMPLETION</Text>
      <Text style={styles.certTitle}>{passportTitle}</Text>
      <Text style={styles.certLabel}>Awarded to:</Text>
      <View style={styles.certLine} />
      <Text style={styles.certLabel}>Date:</Text>
      <View style={[styles.certLine, { width: 120 }]} />
      <Text style={styles.certLabel}>Signed:</Text>
      <View style={[styles.certLine, { width: 120 }]} />
      <Text style={styles.certInstName}>{institutionName}</Text>
    </View>
  )
}

function BlankQuarter() {
  return <View style={styles.blankRoot} />
}

// ---------------------------------------------------------------------------
// Assembly instruction page
// ---------------------------------------------------------------------------

function InstructionPage() {
  return (
    <View style={styles.instructionPage}>
      <Text style={styles.instrTitle}>Teacher Assembly Guide</Text>
      <Text style={styles.instrSubtitle}>
        This page is not part of the student booklet. Do not cut or include it.
      </Text>

      {/* Step 1 */}
      <View style={styles.stepContainer}>
        <Text style={styles.stepLabel}>STEP 1 — PRINT</Text>
        <Text style={styles.stepText}>
          Print this PDF double-sided on standard 8.5×11 paper.
        </Text>
        <View style={styles.diagramBox}>
          <View style={styles.diagramRow}>
            <View style={styles.diagramRect}>
              <Text style={styles.diagramRectLabel}>FRONT</Text>
            </View>
            <Text style={[styles.diagramLabel, { fontSize: 10 }]}>↔</Text>
            <View style={styles.diagramRect}>
              <Text style={styles.diagramRectLabel}>BACK</Text>
            </View>
          </View>
          <Text style={styles.diagramLabel}>Each sheet prints front and back</Text>
        </View>
      </View>

      <View style={styles.stepDivider} />

      {/* Step 2 */}
      <View style={styles.stepContainer}>
        <Text style={styles.stepLabel}>STEP 2 — CUT</Text>
        <Text style={styles.stepText}>
          Cut each sheet along both center lines to get 4 quarter-pages.
        </Text>
        <View style={styles.diagramBox}>
          <View style={[styles.diagramRect, { width: 80, height: 56, position: 'relative', marginBottom: 6 }]}>
            {/* Horizontal cut line */}
            <View style={{ position: 'absolute', left: 0, top: 26, width: 80, height: 0.75, backgroundColor: '#64748B' }} />
            {/* Vertical cut line */}
            <View style={{ position: 'absolute', left: 38, top: 0, width: 0.75, height: 56, backgroundColor: '#64748B' }} />
            <Text style={[styles.diagramRectLabel, { position: 'absolute', top: 8, left: 0, right: 0 }]}>+</Text>
          </View>
          <Text style={styles.diagramLabel}>Cut on the center cross to get 4 pieces</Text>
        </View>
      </View>

      <View style={styles.stepDivider} />

      {/* Step 3 */}
      <View style={styles.stepContainer}>
        <Text style={styles.stepLabel}>STEP 3 — STACK &amp; STAPLE</Text>
        <Text style={styles.stepText}>
          Stack all quarter-pages in order. Staple twice along the left edge.
        </Text>
        <View style={styles.diagramBox}>
          <View style={styles.diagramRow}>
            {/* Side-view stack */}
            <View style={{ alignItems: 'flex-start' }}>
              {[0, 2, 4, 6].map((offset) => (
                <View
                  key={offset}
                  style={{
                    width: 70,
                    height: 5,
                    backgroundColor: offset % 4 === 0 ? '#0D1B2A' : '#E8EEF0',
                    marginBottom: 1,
                    borderRadius: 1,
                    marginLeft: offset * 0.3,
                  }}
                />
              ))}
            </View>
            <Text style={[styles.diagramLabel, { marginLeft: 8, fontSize: 11 }]}>← staple</Text>
          </View>
          <Text style={styles.diagramLabel}>Staple twice on the left edge</Text>
        </View>
      </View>

      <View style={styles.instrFooter}>
        <Text style={styles.instrFooterText}>
          Each child gets one copy of this stack. This assembly guide sheet is not part of the
          booklet — do not include it in student copies.
        </Text>
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Registration marks (crosshairs at cut lines)
// ---------------------------------------------------------------------------

const MARK_HALF = 4   // half-length of each crosshair arm (total 8pt)

function RegistrationMarks() {
  // Cut points: (306,0), (0,396), (306,396), (612,396), (306,792)
  const points: [number, number][] = [
    [QP_W, 0],
    [0, QP_H],
    [QP_W, QP_H],
    [PAGE_W, QP_H],
    [QP_W, PAGE_H],
  ]

  return (
    <>
      {points.map(([cx, cy]) => {
        const hLeft = cx - MARK_HALF
        const hTop = cy - 0.25
        const vLeft = cx - 0.25
        const vTop = cy - MARK_HALF

        return (
          <View key={`${cx}-${cy}`}>
            {/* Horizontal arm */}
            <View
              style={{
                position: 'absolute',
                left: hLeft,
                top: hTop,
                width: MARK_HALF * 2,
                height: 0.5,
                backgroundColor: '#CCCCCC',
                opacity: 0.3,
              }}
            />
            {/* Vertical arm */}
            <View
              style={{
                position: 'absolute',
                left: vLeft,
                top: vTop,
                width: 0.5,
                height: MARK_HALF * 2,
                backgroundColor: '#CCCCCC',
                opacity: 0.3,
              }}
            />
          </View>
        )
      })}
    </>
  )
}

// ---------------------------------------------------------------------------
// Quarter-page grid positions
// ---------------------------------------------------------------------------

const GRID_POSITIONS: [number, number][] = [
  [0, 0],         // top-left
  [QP_W, 0],      // top-right
  [0, QP_H],      // bottom-left
  [QP_W, QP_H],   // bottom-right
]

// ---------------------------------------------------------------------------
// Full PDF document
// ---------------------------------------------------------------------------

type QuarterNode =
  | { type: 'cover'; passportTitle: string; institutionName: string; coverEmblem?: string | null }
  | { type: 'stop'; stop: PrintStop; index: number; showJournal: boolean }
  | { type: 'cert'; passportTitle: string; institutionName: string }
  | { type: 'blank' }

interface PrintPassportDocProps {
  quarters: QuarterNode[]
}

function PrintPassportDoc({ quarters }: PrintPassportDocProps) {
  // Group into sets of 4
  const sheets: QuarterNode[][] = []
  for (let i = 0; i < quarters.length; i += 4) {
    sheets.push(quarters.slice(i, i + 4))
  }

  return (
    <Document>
      {/* Page 1: assembly instructions */}
      <Page size={[PAGE_W, PAGE_H]} style={styles.fullPage}>
        <InstructionPage />
      </Page>

      {/* Content pages */}
      {sheets.map((sheet, sheetIdx) => (
        <Page key={sheetIdx} size={[PAGE_W, PAGE_H]} style={styles.contentPage}>
          {sheet.map((qp, qpIdx) => {
            const [x, y] = GRID_POSITIONS[qpIdx]
            return (
              <View
                key={qpIdx}
                style={[styles.quarterCell, { left: x, top: y }]}
              >
                {qp.type === 'cover' && (
                  <CoverQuarter
                    passportTitle={qp.passportTitle}
                    institutionName={qp.institutionName}
                    coverEmblem={qp.coverEmblem}
                  />
                )}
                {qp.type === 'stop' && (
                  <StopQuarter
                    stop={qp.stop}
                    index={qp.index}
                    showJournal={qp.showJournal}
                  />
                )}
                {qp.type === 'cert' && (
                  <CertQuarter
                    passportTitle={qp.passportTitle}
                    institutionName={qp.institutionName}
                  />
                )}
                {qp.type === 'blank' && <BlankQuarter />}
              </View>
            )
          })}
          <RegistrationMarks />
        </Page>
      ))}
    </Document>
  )
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()

  // ── 1. Auth ──────────────────────────────────────────────────────────────
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── 2. Parse body ─────────────────────────────────────────────────────────
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

  const passportId = params.id

  // ── 3. Fetch passport ─────────────────────────────────────────────────────
  const { data: passport, error: passportError } = await supabase
    .from('passports')
    .select('id, title, creator_id, proprietor_id, cover_emblem')
    .eq('id', passportId)
    .single()

  if (passportError || !passport) {
    return new Response(JSON.stringify({ error: 'Passport not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Must be institutional (has proprietor_id)
  if (!passport.proprietor_id) {
    return new Response(
      JSON.stringify({ error: 'Print passports are only available for institutional passports' }),
      { status: 422, headers: { 'Content-Type': 'application/json' } },
    )
  }

  // ── 4. Authorization: must be creator or employee of the institution ───────
  const isCreator = passport.creator_id === user.id

  if (!isCreator) {
    const { data: authz, error: authzError } = await supabase
      .from('employee_authorizations')
      .select('id')
      .eq('user_id', user.id)
      .eq('institution_id', passport.proprietor_id)
      .maybeSingle()

    if (authzError || !authz) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to print this passport' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      )
    }
  }

  // ── 5. Fetch institution ──────────────────────────────────────────────────
  const { data: institution, error: institutionError } = await supabase
    .from('institutions')
    .select('id, name')
    .eq('id', passport.proprietor_id)
    .single()

  if (institutionError || !institution) {
    return new Response(JSON.stringify({ error: 'Institution not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── 6. Fetch stops belonging to this passport, in the requested order ──────
  // First, get all page IDs for this passport
  const { data: pages, error: pagesError } = await supabase
    .from('passport_pages')
    .select('id')
    .eq('passport_id', passportId)

  if (pagesError) {
    return new Response(JSON.stringify({ error: 'Failed to fetch passport pages' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const pageIds = (pages ?? []).map((p: { id: string }) => p.id)

  // Fetch only stops that belong to this passport AND are in stop_ids
  const { data: stopsRaw, error: stopsError } = await supabase
    .from('stops')
    .select('id, name, stop_order, page_id, journal_prompt, print_include_journal')
    .in('id', stop_ids.length > 0 ? stop_ids : ['__none__'])
    .in('page_id', pageIds.length > 0 ? pageIds : ['__none__'])

  if (stopsError) {
    return new Response(JSON.stringify({ error: 'Failed to fetch stops' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Build a map and reorder according to stop_ids order
  const stopMap = new Map<string, PrintStop>()
  for (const s of stopsRaw ?? []) {
    stopMap.set(s.id, {
      id: s.id,
      name: s.name,
      stop_order: s.stop_order,
      journal_prompt: (s as Record<string, unknown>).journal_prompt as string | null ?? null,
      print_include_journal: Boolean((s as Record<string, unknown>).print_include_journal ?? false),
    })
  }

  const orderedStops: PrintStop[] = stop_ids
    .map((sid) => stopMap.get(sid))
    .filter((s): s is PrintStop => s !== undefined)

  // ── 7. Build quarter-page list ────────────────────────────────────────────
  const quarters: QuarterNode[] = []

  // Cover
  quarters.push({
    type: 'cover',
    passportTitle: passport.title,
    institutionName: institution.name,
    coverEmblem: passport.cover_emblem,
  })

  // Stops
  orderedStops.forEach((stop, idx) => {
    let showJournal: boolean
    if (journal_override === 'include_all') {
      showJournal = true
    } else if (journal_override === 'exclude_all') {
      showJournal = false
    } else {
      // per-stop
      showJournal = stop.print_include_journal
    }

    quarters.push({
      type: 'stop',
      stop,
      index: idx + 1,
      showJournal,
    })
  })

  // Certificate
  quarters.push({
    type: 'cert',
    passportTitle: passport.title,
    institutionName: institution.name,
  })

  // Pad to nearest multiple of 4
  while (quarters.length % 4 !== 0) {
    quarters.push({ type: 'blank' })
  }

  // ── 8. Generate PDF ───────────────────────────────────────────────────────
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderToBuffer(<PrintPassportDoc quarters={quarters} />)
  } catch (err) {
    console.error('[print-pdf] renderToBuffer error:', err)
    return new Response(JSON.stringify({ error: 'PDF generation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── 9. Log print job ──────────────────────────────────────────────────────
  const journalSetting = journal_override ?? 'per_stop'

  try {
    await supabase.from('print_jobs').insert({
      passport_id: passportId,
      institution_id: passport.proprietor_id,
      created_by: user.id,
      stop_ids,
      copies,
      journal_setting: journalSetting,
    })
  } catch (err) {
    // Log but don't fail the request — the PDF is already generated
    console.warn('[print-pdf] Failed to log print job:', err)
  }

  // ── 10. Return PDF ────────────────────────────────────────────────────────
  const dateStr = new Date().toISOString().slice(0, 10)
  const safeTitle = passport.title.replace(/[^\w\s\-]/g, '').trim()
  const filename = `${safeTitle} — Print Passport — ${dateStr}.pdf`

  return new Response(pdfBuffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
