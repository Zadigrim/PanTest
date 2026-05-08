import React from 'react'
import { renderToBuffer, Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'

// ── Artboard (designer canvas) dimensions ─────────────────────────────────────
// Matches Canvas.tsx constants — all box_x/y/width/height values are in these units
const ARTBOARD_W = 612   // pixels
const ARTBOARD_H = 792   // pixels

// ── Print sheet layout (points: 72pt = 1 inch) ────────────────────────────────
const SHEET_W = 612   // 8.5 in
const SHEET_H = 792   // 11 in
const SLOT_W  = 612   // full sheet width
const SLOT_H  = 396   // 5.5 in — half of sheet height
const FOLD_X  = 306   // 4.25 in — vertical fold center
const CUT_Y   = 396   // 5.5 in — horizontal cut line
const PAD     = 14    // slot interior padding (~0.2 in)

// ── Scaled artboard within each slot ─────────────────────────────────────────
// Reserve 20pt for section title + gap; remainder is the canvas height
const CANVAS_AREA_H  = SLOT_H - 2 * PAD - 20          // ~348pt
const CANVAS_SCALE   = CANVAS_AREA_H / ARTBOARD_H      // ≈0.440
const CANVAS_W       = ARTBOARD_W * CANVAS_SCALE        // ≈269pt  (portrait, fits in slot)
const CANVAS_H       = ARTBOARD_H * CANVAS_SCALE        // ≈348pt
const CANVAS_OFFSET_X = (SLOT_W - 2 * PAD - CANVAS_W) / 2  // centre horizontally in slot

// ── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({

  // Full sheet (PDF page)
  sheet: {
    width: SHEET_W,
    height: SHEET_H,
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },

  // Registration mark pieces — absolutely positioned on the sheet
  regH: { position: 'absolute', height: 0.5, backgroundColor: '#CCCCCC' },
  regV: { position: 'absolute', width: 0.5,  backgroundColor: '#CCCCCC' },

  // Slot divider at cut line
  slotDivider: {
    position: 'absolute',
    left: 0, top: CUT_Y,
    width: SHEET_W, height: 0.5,
    backgroundColor: '#CCCCCC',
  },

  // Slot: one half-sheet, absolutely positioned on the sheet
  slot: {
    position: 'absolute',
    width: SLOT_W,
    height: SLOT_H,
    overflow: 'hidden',
    flexDirection: 'column',
  },

  // Fold guide — thin vertical line at FOLD_X
  foldGuide: {
    position: 'absolute',
    left: FOLD_X, top: 0,
    width: 0.5, height: SLOT_H,
    backgroundColor: '#DDDDDD',
  },

  // Padded content area inside slot
  slotContent: {
    flex: 1,
    padding: PAD,
    flexDirection: 'column',
    overflow: 'hidden',
  },

  // Page number — bottom-right of slot
  pgNum: {
    position: 'absolute',
    bottom: PAD, right: PAD,
    fontSize: 8, color: '#888888',
    fontFamily: 'Helvetica',
  },

  // ── Passport page slot ─────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 4,
  },

  // The scaled artboard container
  pageCanvas: {
    position: 'relative',
    borderWidth: 0.5,
    borderColor: '#DDDDDD',
    borderStyle: 'solid',
    backgroundColor: '#FAFAFA',
  },

  // Each LocationBox on the scaled canvas
  locationBox: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: '#999999',
    borderStyle: 'solid',
    borderRadius: 2,
    backgroundColor: '#FFFFFF',
  },

  // Stop name at bottom of LocationBox
  locationBoxName: {
    position: 'absolute',
    bottom: 2, left: 0, right: 0,
    textAlign: 'center',
    fontSize: 5,
    color: '#AAAAAA',
    fontFamily: 'Helvetica',
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

  instrStepBody: { flex: 1 },

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

  instrFooter: { marginTop: 'auto' },

  instrFooterText: {
    fontSize: 11,
    color: '#777777',
    textAlign: 'center',
  },
})

// ── Types ─────────────────────────────────────────────────────────────────────

interface StopForPrint {
  id: string
  name: string
  stop_order: number
  box_x: number
  box_y: number
  box_width: number
  box_height: number
}

interface PassportPageForPrint {
  id: string
  page_order: number
  page_type: 'stamp' | 'information'
  section_name: string
  section_title: string | null
  stops: StopForPrint[]
}

type SlotContent =
  | { type: 'cover'; title: string; subtitle: string }
  | { type: 'page'; page: PassportPageForPrint }
  | { type: 'cert'; title: string; institutionName: string }
  | { type: 'blank' }

// ── Registration marks: crosshairs at left/right edges of cut line ────────────

function RegistrationMarks() {
  const len  = 16
  const half = len / 2
  const y    = CUT_Y

  return (
    <>
      <View style={[S.regH, { left: 0,                    top: y - 0.25, width: len  }]} />
      <View style={[S.regV, { left: half - 0.25,          top: y - half, height: len }]} />
      <View style={[S.regH, { left: SHEET_W - len,        top: y - 0.25, width: len  }]} />
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

function PassportPageSlotContent({ page }: { page: PassportPageForPrint }) {
  const label = page.section_title || page.section_name || `Page ${page.page_order}`

  return (
    <>
      {/* Section title */}
      <Text style={S.sectionTitle}>{label}</Text>

      {/* Scaled artboard canvas with LocationBoxes */}
      <View
        style={[
          S.pageCanvas,
          { width: CANVAS_W, height: CANVAS_H, marginLeft: CANVAS_OFFSET_X },
        ]}
      >
        {page.stops.map((stop) => {
          const x = stop.box_x * CANVAS_SCALE
          const y = stop.box_y * CANVAS_SCALE
          const w = stop.box_width  * CANVAS_SCALE
          const h = stop.box_height * CANVAS_SCALE

          return (
            <View key={stop.id} style={[S.locationBox, { left: x, top: y, width: w, height: h }]}>
              <Text style={S.locationBoxName}>{stop.name}</Text>
            </View>
          )
        })}
      </View>
    </>
  )
}

function CertSlotContent({ title, institutionName }: { title: string; institutionName: string }) {
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
      <View style={S.foldGuide} />

      <View style={S.slotContent}>
        {content.type === 'cover' && (
          <CoverSlotContent title={content.title} subtitle={content.subtitle} />
        )}
        {content.type === 'page' && (
          <PassportPageSlotContent page={content.page} />
        )}
        {content.type === 'cert' && (
          <CertSlotContent title={content.title} institutionName={content.institutionName} />
        )}
        {/* blank: empty */}
      </View>

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
      <RegistrationMarks />
      <View style={S.slotDivider} />
      <Slot content={topSlot}    slotTop={0}     pageNum={topPageNum}    />
      <Slot content={bottomSlot} slotTop={CUT_Y} pageNum={bottomPageNum} />
    </Page>
  )
}

// ── Assembly instruction page ─────────────────────────────────────────────────

function InstructionPage({
  passportTitle,
  institutionName,
  pageCount,
  totalSlots,
}: {
  passportTitle: string
  institutionName: string
  pageCount: number
  totalSlots: number
}) {
  const sheetCount = Math.ceil(totalSlots / 4)
  const meta =
    pageCount + ' page' + (pageCount !== 1 ? 's' : '') +
    ' · ' + (totalSlots) + ' booklet pages' +
    ' · ' + sheetCount + ' sheet' + (sheetCount !== 1 ? 's' : '') + ' per copy'

  return (
    <Page size={[SHEET_W, SHEET_H]} style={S.instrPage}>
      <Text style={S.instrBrand}>PANOPLY</Text>

      <Text style={S.instrDocLabel}>Print-ready passport booklet</Text>
      <Text style={S.instrPassportTitle}>{passportTitle}</Text>
      {institutionName ? <Text style={S.instrInstName}>{institutionName}</Text> : null}
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
  pages: PassportPageForPrint[]
}

function PrintPassportDoc({ passportTitle, institutionName, pages }: PrintPassportDocProps) {
  // Build sequential slot list: Cover → passport pages → Certificate
  const slots: SlotContent[] = []

  slots.push({ type: 'cover', title: passportTitle, subtitle: institutionName })

  for (const page of pages) {
    slots.push({ type: 'page', page })
  }

  slots.push({ type: 'cert', title: passportTitle, institutionName })

  // Pad to even so every slot has a pair
  if (slots.length % 2 !== 0) slots.push({ type: 'blank' })

  // Group into content PDF pages (pairs of slots)
  const contentPages: [SlotContent, SlotContent][] = []
  for (let i = 0; i < slots.length; i += 2) {
    contentPages.push([slots[i], slots[i + 1]])
  }

  const contentSlotCount = slots.filter((s) => s.type !== 'blank').length

  return (
    <Document>
      {/* Page 1: assembly instructions */}
      <InstructionPage
        passportTitle={passportTitle}
        institutionName={institutionName}
        pageCount={pages.length}
        totalSlots={contentSlotCount}
      />

      {/* Content pages: two slots per sheet, sequential imposition */}
      {contentPages.map((pair, pIdx) => (
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
    .single() as {
      data: { id: string; title: string; creator_id: string; proprietor_id: string | null } | null
      error: unknown
    }

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

  // ── 5. Institution name (personal passports have no proprietor) ──────────
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

  // ── 6. Fetch passport pages ordered by page_order ────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pagesRaw, error: pagesErr } = await (supabase as any)
    .from('passport_pages')
    .select('id, page_order, page_type, section_name, section_title')
    .eq('passport_id', passportId)
    .order('page_order', { ascending: true }) as {
      data: {
        id: string
        page_order: number
        page_type: string
        section_name: string
        section_title: string | null
      }[] | null
      error: unknown
    }

  if (pagesErr || !pagesRaw || pagesRaw.length === 0) {
    return new Response(JSON.stringify({ error: 'No pages found for this passport' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── 7. Fetch all stops for all pages ─────────────────────────────────────
  const pageIds = pagesRaw.map((p) => p.id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stopsRaw, error: stopsErr } = await (supabase as any)
    .from('stops')
    .select('id, page_id, stop_order, name, box_x, box_y, box_width, box_height')
    .in('page_id', pageIds)
    .order('stop_order', { ascending: true }) as {
      data: {
        id: string
        page_id: string
        stop_order: number
        name: string
        box_x: number | null
        box_y: number | null
        box_width: number
        box_height: number
      }[] | null
      error: unknown
    }

  if (stopsErr) {
    return new Response(JSON.stringify({ error: 'Failed to fetch stops' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── 8. Build per-page data for the PDF ───────────────────────────────────
  // A page is included if at least one of its stops is in stop_ids,
  // OR if no stop selection was made (stop_ids empty → include all pages).
  const selectedIds = new Set(stop_ids)
  const includeAll  = stop_ids.length === 0

  const pagesForPrint: PassportPageForPrint[] = pagesRaw
    .map((page) => {
      const pageStops = (stopsRaw ?? [])
        .filter((s) => s.page_id === page.id)
        .map((s) => ({
          id:          s.id,
          name:        s.name,
          stop_order:  s.stop_order,
          box_x:       s.box_x  ?? 40,
          box_y:       s.box_y  ?? 40,
          box_width:   s.box_width  ?? 120,
          box_height:  s.box_height ?? 120,
        }))

      return {
        id:            page.id,
        page_order:    page.page_order,
        page_type:     (page.page_type as 'stamp' | 'information') ?? 'stamp',
        section_name:  page.section_name ?? '',
        section_title: page.section_title,
        stops:         pageStops,
      }
    })
    .filter((page) => {
      if (page.page_type === 'information') return true  // always include info pages
      if (includeAll) return true
      return page.stops.some((s) => selectedIds.has(s.id))
    })

  // ── 9. Render PDF ────────────────────────────────────────────────────────
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderToBuffer(
      <PrintPassportDoc
        passportTitle={passport.title}
        institutionName={institutionName}
        pages={pagesForPrint}
      />
    )
  } catch (err) {
    console.error('[print-pdf] renderToBuffer error:', err)
    return new Response(JSON.stringify({ error: 'PDF generation failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // ── 10. Log print job (best-effort) ──────────────────────────────────────
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

  // ── 11. Return PDF ────────────────────────────────────────────────────────
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
