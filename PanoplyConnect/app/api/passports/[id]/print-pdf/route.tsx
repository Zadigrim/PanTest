import React from 'react'
import { renderToBuffer, Document, Page, View, Text, StyleSheet, Svg, Ellipse, Path, Line, Image } from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'

// ── Artboard (designer canvas) dimensions ─────────────────────────────────────
// Matches Canvas.tsx constants — all box_x/y/width/height values are in these units
const ARTBOARD_W = 612   // pixels
const ARTBOARD_H = 792   // pixels

// ── Print sheet layout (points: 72pt = 1 inch) ────────────────────────────────
const SHEET_W = 612   // 8.5 in
const SHEET_H = 792   // 11 in
const QUAD_W  = 306   // 4.25 in — quadrant width (half of sheet width)
const QUAD_H  = 396   // 5.5 in  — quadrant height (half of sheet height)
const CUT_X   = 306   // vertical cut line
const CUT_Y   = 396   // horizontal cut line
const PAD     = 14    // quadrant interior padding (~0.2 in)

// ── Scaled artboard within each quadrant ─────────────────────────────────────
// Reserve 20pt for section title; fit the 612:792 artboard into remaining space.
const CANVAS_AREA_H   = QUAD_H - 2 * PAD - 20            // 348pt
const CANVAS_AREA_W   = QUAD_W - 2 * PAD                 // 278pt
const ASPECT_RATIO    = ARTBOARD_H / ARTBOARD_W           // ≈1.2941
const FIT_BY_HEIGHT_W = CANVAS_AREA_H / ASPECT_RATIO     // ≈268.8pt
// Height-fit wins: FIT_BY_HEIGHT_W (269) < CANVAS_AREA_W (278)
const CANVAS_H        = CANVAS_AREA_H                     // 348pt
const CANVAS_W        = FIT_BY_HEIGHT_W                   // ≈269pt
const CANVAS_SCALE    = CANVAS_H / ARTBOARD_H             // ≈0.4394
const CANVAS_OFFSET_X = (QUAD_W - 2 * PAD - CANVAS_W) / 2 // ≈4.6pt

// ── Quadrant top-left corner positions on the sheet ───────────────────────────
const QUAD_POSITIONS: { x: number; y: number }[] = [
  { x: 0,     y: 0     },  // top-left
  { x: CUT_X, y: 0     },  // top-right
  { x: 0,     y: CUT_Y },  // bottom-left
  { x: CUT_X, y: CUT_Y },  // bottom-right
]

// ── Styles ────────────────────────────────────────────────────────────────────
const S = StyleSheet.create({

  // Full sheet (PDF page)
  sheet: {
    width: SHEET_W,
    height: SHEET_H,
    backgroundColor: '#FFFFFF',
    position: 'relative',
  },

  // Cut guide lines — rendered below quadrant content
  guideH: {
    position: 'absolute',
    left: 0,
    height: 0.5,
    width: SHEET_W,
    backgroundColor: '#EEEEEE',
  },
  guideV: {
    position: 'absolute',
    top: 0,
    width: 0.5,
    height: SHEET_H,
    backgroundColor: '#EEEEEE',
  },

  // Registration mark pieces — crosshairs at sheet edge intersections
  regH: { position: 'absolute', height: 0.5, backgroundColor: '#CCCCCC' },
  regV: { position: 'absolute', width: 0.5,  backgroundColor: '#CCCCCC' },

  // Quadrant: one quarter-sheet, absolutely positioned on the sheet
  slot: {
    position: 'absolute',
    width: QUAD_W,
    height: QUAD_H,
    overflow: 'hidden',
    flexDirection: 'column',
  },

  // Padded content area inside quadrant
  slotContent: {
    flex: 1,
    padding: PAD,
    flexDirection: 'column',
    overflow: 'hidden',
  },

  // Page number — bottom-left of quadrant (left edge = staple edge of finished booklet)
  pgNum: {
    position: 'absolute',
    bottom: PAD,
    left: PAD,
    fontSize: 8,
    color: '#888888',
    fontFamily: 'Helvetica',
  },

  // ── Assembly instructions ──────────────────────────────────────────────────
  instrTitle: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#1A1A1A',
    marginBottom: 8,
  },

  instrStep: {
    flexDirection: 'row',
    marginBottom: 6,
    alignItems: 'flex-start',
  },

  instrStepNum: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#1A1A1A',
    width: 14,
  },

  instrStepText: {
    flex: 1,
    fontSize: 9,
    fontFamily: 'Helvetica',
    color: '#333333',
    lineHeight: 1.4,
  },

  instrStepLabel: {
    fontFamily: 'Helvetica-Bold',
    color: '#1A1A1A',
  },

  instrRule: {
    height: 0.5,
    backgroundColor: '#CCCCCC',
    marginTop: 8,
    marginBottom: 8,
  },

  instrFooter: {
    fontSize: 8,
    fontFamily: 'Helvetica-Oblique',
    color: '#666666',
  },

  // ── Passport page quadrant ────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    textAlign: 'center',
    marginBottom: 4,
  },

  // Scaled artboard container (backgroundColor applied inline from page data)
  pageCanvas: {
    position: 'relative',
    borderWidth: 0.5,
    borderColor: '#DDDDDD',
    borderStyle: 'solid',
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

  // Stop name inside LocationBox
  locationBoxName: {
    position: 'absolute',
    bottom: 2, left: 0, right: 0,
    textAlign: 'center',
    fontSize: 5,
    color: '#AAAAAA',
    fontFamily: 'Helvetica',
  },

  // ── Cover quadrant ────────────────────────────────────────────────────────
  coverInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'column',
  },

  coverTitle: {
    fontSize: 14,
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
    width: '100%',
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

  // ── Certificate quadrant ──────────────────────────────────────────────────
  certInner: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },

  certHeading: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: '#333333',
    alignSelf: 'center',
    marginBottom: 6,
  },

  certTitle: {
    fontSize: 12,
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

interface BaseElement {
  id: string
  x: number
  y: number
  width: number
  height: number
}

interface TextPageElement extends BaseElement {
  type: 'text'
  content?: string
  fontSize?: number
  fontWeight?: 'normal' | 'bold'
  color?: string       // hex without #
  align?: 'left' | 'center' | 'right'
}

interface HLinePageElement extends BaseElement {
  type: 'hline'
  thickness?: number
  lineColor?: string   // hex without #
}

interface VLinePageElement extends BaseElement {
  type: 'vline'
  thickness?: number
  lineColor?: string   // hex without #
}

type PageElement = TextPageElement | HLinePageElement | VLinePageElement

interface PassportPageForPrint {
  id: string
  page_order: number
  page_type: 'stamp' | 'information'
  section_name: string
  section_title: string | null
  stops: StopForPrint[]
  elements: PageElement[]
  paper_color: string          // hex without #, e.g. 'F5F2EC'
  background_type: string      // 'guilloche' | 'grid' | 'none' | 'custom'
  background_color: string     // hex without #
  background_opacity: number   // 8–12
  background_image_url: string | null
}

type SlotContent =
  | { type: 'instructions' }
  | { type: 'cover'; title: string; subtitle: string }
  | { type: 'page'; page: PassportPageForPrint }
  | { type: 'cert'; title: string; institutionName: string }
  | { type: 'blank' }

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, opacityPct: number): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return `rgba(0,0,0,${opacityPct / 100})`
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${(opacityPct / 100).toFixed(2)})`
}

// ── Cut guides and registration crosshairs ────────────────────────────────────

function RegistrationMarks() {
  const len  = 16
  const half = len / 2

  // Crosshairs at the four sheet-edge intersections of the two cut lines
  const positions = [
    { x: 0,       y: CUT_Y },  // left edge, horizontal cut
    { x: SHEET_W, y: CUT_Y },  // right edge, horizontal cut
    { x: CUT_X,   y: 0       },  // top edge, vertical cut
    { x: CUT_X,   y: SHEET_H },  // bottom edge, vertical cut
  ]

  return (
    <>
      {/* Faint guide lines */}
      <View style={[S.guideH, { top: CUT_Y - 0.25 }]} />
      <View style={[S.guideV, { left: CUT_X - 0.25 }]} />

      {/* Crosshairs */}
      {positions.map((pos, i) => (
        <React.Fragment key={i}>
          <View style={[S.regH, { left: pos.x - half, top: pos.y - 0.25, width: len }]} />
          <View style={[S.regV, { left: pos.x - 0.25, top: pos.y - half, height: len }]} />
        </React.Fragment>
      ))}
    </>
  )
}

// ── Quadrant content components ───────────────────────────────────────────────

function InstructionsQuadrantContent() {
  const steps: { label: string; body: string }[] = [
    { label: 'Print',   body: 'Print all sheets single-sided.' },
    { label: 'Cut',     body: 'Cut each sheet into four pieces along the lines.' },
    { label: 'Stack',   body: 'For each student, stack the pieces in this order: Cover, then pages 1, 2, 3 in number order (corner of each piece), then Certificate at the bottom.' },
    { label: 'Staple',  body: 'Staple twice along the left edge.' },
  ]

  return (
    <>
      <Text style={S.instrTitle}>How to assemble</Text>

      {steps.map((step, i) => (
        <View key={i} style={S.instrStep}>
          <Text style={S.instrStepNum}>{i + 1}.</Text>
          <Text style={S.instrStepText}>
            <Text style={S.instrStepLabel}>{step.label}{'  '}</Text>
            {step.body}
          </Text>
        </View>
      ))}

      <View style={S.instrRule} />

      <Text style={S.instrFooter}>
        Students stamp or sticker each page as they complete each stop.
      </Text>
    </>
  )
}

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

// ── Page element rendering (text, hline, vline) ───────────────────────────────

function TextEl({ el, scale }: { el: TextPageElement; scale: number }) {
  const color      = `#${el.color ?? '0D1B2A'}`
  const fontSize   = (el.fontSize ?? 14) * scale
  const fontFamily = el.fontWeight === 'bold' ? 'Helvetica-Bold' : 'Helvetica'
  const textAlign  = el.align ?? 'left'

  return (
    <View
      style={{
        position: 'absolute',
        left:   el.x * scale,
        top:    el.y * scale,
        width:  el.width  * scale,
        height: el.height * scale,
        overflow: 'hidden',
      }}
    >
      <Text style={{ fontSize, fontFamily, color, textAlign }}>
        {el.content ?? ''}
      </Text>
    </View>
  )
}

function HLineEl({ el, scale }: { el: HLinePageElement; scale: number }) {
  const thickness = el.thickness ?? 2
  const color     = `#${el.lineColor ?? '0D1B2A'}`
  // Center the bar within the element's bounding box height
  const top  = (el.y + el.height / 2 - thickness / 2) * scale
  const left = el.x * scale

  return (
    <View
      style={{
        position: 'absolute',
        left,
        top,
        width:  el.width    * scale,
        height: thickness   * scale,
        backgroundColor: color,
      }}
    />
  )
}

function VLineEl({ el, scale }: { el: VLinePageElement; scale: number }) {
  const thickness = el.thickness ?? 2
  const color     = `#${el.lineColor ?? '0D1B2A'}`
  // Center the bar within the element's bounding box width
  const left = (el.x + el.width / 2 - thickness / 2) * scale
  const top  = el.y * scale

  return (
    <View
      style={{
        position: 'absolute',
        left,
        top,
        width:  thickness   * scale,
        height: el.height   * scale,
        backgroundColor: color,
      }}
    />
  )
}

function PageElementsLayer({ elements, scale }: { elements: PageElement[]; scale: number }) {
  return (
    <>
      {(elements ?? []).map((el) => {
        try {
          if (el.type === 'text')  return <TextEl  key={el.id} el={el} scale={scale} />
          if (el.type === 'hline') return <HLineEl key={el.id} el={el} scale={scale} />
          if (el.type === 'vline') return <VLineEl key={el.id} el={el} scale={scale} />
        } catch {
          // Skip malformed elements rather than crashing the PDF
        }
        return null
      })}
    </>
  )
}

// ── Background overlay components ─────────────────────────────────────────────
// These render into the scaled canvas (CANVAS_W × CANVAS_H) using a viewBox of
// the full artboard (612 × 792) so the pattern density matches the designer.

function GuillocheOverlay({ color, opacity }: { color: string; opacity: number }) {
  const tileSize = 32
  const cols = Math.ceil(ARTBOARD_W / tileSize) + 1
  const rows = Math.ceil(ARTBOARD_H / tileSize) + 1
  // Use strokeOpacity attribute on each element — @react-pdf ignores CSS opacity on Svg containers
  const strokeOpacity = Math.max(8, Math.min(12, opacity)) / 100

  const tiles: React.ReactNode[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x  = c * tileSize
      const y  = r * tileSize
      const cx = x + 16
      const cy = y + 16
      const ts = tileSize
      tiles.push(
        <React.Fragment key={`${r}-${c}`}>
          <Ellipse cx={cx} cy={cy} rx={14} ry={7}  strokeWidth={0.6} stroke={color} fill="none" strokeOpacity={strokeOpacity} />
          <Ellipse cx={cx} cy={cy} rx={7}  ry={14} strokeWidth={0.6} stroke={color} fill="none" strokeOpacity={strokeOpacity} />
          <Path
            d={`M${cx},${y+2} L${x+ts-2},${cy} L${cx},${y+ts-2} L${x+2},${cy} Z`}
            strokeWidth={0.4} stroke={color} fill="none" strokeOpacity={strokeOpacity}
          />
        </React.Fragment>,
      )
    }
  }

  return (
    <Svg
      viewBox={`0 0 ${ARTBOARD_W} ${ARTBOARD_H}`}
      style={{ position: 'absolute', top: 0, left: 0, width: CANVAS_W, height: CANVAS_H }}
    >
      {tiles}
    </Svg>
  )
}

function GridOverlay({ color, opacity }: { color: string; opacity: number }) {
  const minor  = 12   // artboard units between minor lines
  const major  = 60   // artboard units between major lines
  // Use strokeOpacity on each Line — @react-pdf ignores CSS opacity on Svg containers
  const minorOpacity = Math.max(8, Math.min(12, opacity)) / 100
  const majorOpacity = Math.min(1, minorOpacity * 2.5)

  const lines: React.ReactNode[] = []
  for (let x = 0; x <= ARTBOARD_W; x += minor) {
    const isMajor = x % major === 0
    lines.push(
      <Line key={`v${x}`} x1={x} y1={0} x2={x} y2={ARTBOARD_H}
        stroke={color}
        strokeWidth={isMajor ? 0.8 : 0.35}
        strokeOpacity={isMajor ? majorOpacity : minorOpacity}
      />,
    )
  }
  for (let y = 0; y <= ARTBOARD_H; y += minor) {
    const isMajor = y % major === 0
    lines.push(
      <Line key={`h${y}`} x1={0} y1={y} x2={ARTBOARD_W} y2={y}
        stroke={color}
        strokeWidth={isMajor ? 0.8 : 0.35}
        strokeOpacity={isMajor ? majorOpacity : minorOpacity}
      />,
    )
  }

  return (
    <Svg
      viewBox={`0 0 ${ARTBOARD_W} ${ARTBOARD_H}`}
      style={{ position: 'absolute', top: 0, left: 0, width: CANVAS_W, height: CANVAS_H }}
    >
      {lines}
    </Svg>
  )
}

function PassportPageSlotContent({ page }: { page: PassportPageForPrint }) {
  const label      = page.section_title || page.section_name || `Page ${page.page_order}`
  const paperColor = `#${page.paper_color ?? 'F5F2EC'}`
  const bgColor    = `#${page.background_color ?? '0D1B2A'}`
  const bgOpacity  = Math.min(12, Math.max(8, page.background_opacity ?? 10))

  return (
    <>
      <Text style={S.sectionTitle}>{label}</Text>

      <View
        style={[
          S.pageCanvas,
          { width: CANVAS_W, height: CANVAS_H, marginLeft: CANVAS_OFFSET_X, backgroundColor: paperColor },
        ]}
      >
        {/* Background pattern or image overlay */}
        {page.background_type === 'guilloche' && (
          <GuillocheOverlay color={bgColor} opacity={bgOpacity} />
        )}
        {page.background_type === 'grid' && (
          <GridOverlay color={bgColor} opacity={bgOpacity} />
        )}
        {page.background_type === 'custom' && page.background_image_url && (
          <Image
            src={page.background_image_url}
            style={{ position: 'absolute', top: 0, left: 0, width: CANVAS_W, height: CANVAS_H, objectFit: 'cover', opacity: bgOpacity / 100 }}
          />
        )}

        {/* Elements rendered before (below) LocationBoxes */}
        <PageElementsLayer elements={page.elements} scale={CANVAS_SCALE} />

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

// ── Quadrant wrapper ──────────────────────────────────────────────────────────

function Slot({
  content,
  position,
  pageNum,
}: {
  content: SlotContent
  position: { x: number; y: number }
  pageNum: number | null
}) {
  return (
    <View style={[S.slot, { top: position.y, left: position.x }]}>
      <View style={S.slotContent}>
        {content.type === 'instructions' && <InstructionsQuadrantContent />}
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

      {pageNum !== null && (
        <Text style={S.pgNum}>{pageNum}</Text>
      )}
    </View>
  )
}

// ── Sheet page: four quadrants + cut guides ───────────────────────────────────

function SheetPage({
  quadrants,
  pageNums,
}: {
  quadrants: [SlotContent, SlotContent, SlotContent, SlotContent]
  pageNums: [number | null, number | null, number | null, number | null]
}) {
  return (
    <Page size={[SHEET_W, SHEET_H]} style={S.sheet}>
      <RegistrationMarks />
      {QUAD_POSITIONS.map((pos, i) => (
        <Slot key={i} content={quadrants[i]} position={pos} pageNum={pageNums[i]} />
      ))}
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
  // Build sequential slot list: Instructions → Cover → interior pages → Certificate
  const slots: SlotContent[] = []

  slots.push({ type: 'instructions' })
  slots.push({ type: 'cover', title: passportTitle, subtitle: institutionName })

  for (const page of pages) {
    slots.push({ type: 'page', page })
  }

  slots.push({ type: 'cert', title: passportTitle, institutionName })

  // Pad to a multiple of 4
  while (slots.length % 4 !== 0) {
    slots.push({ type: 'blank' })
  }

  // Compute page numbers — instructions, cover, and blank slots are unnumbered
  let pageNumber = 0
  const pageNumbers: (number | null)[] = slots.map((slot) => {
    if (slot.type === 'instructions' || slot.type === 'cover' || slot.type === 'blank') {
      return null
    }
    pageNumber++
    return pageNumber
  })

  // Group into sheets of 4 quadrants
  const sheets: SlotContent[][] = []
  for (let i = 0; i < slots.length; i += 4) {
    sheets.push(slots.slice(i, i + 4))
  }

  return (
    <Document>
      {sheets.map((quadrants, sheetIdx) => (
        <SheetPage
          key={sheetIdx}
          quadrants={quadrants as [SlotContent, SlotContent, SlotContent, SlotContent]}
          pageNums={
            pageNumbers.slice(sheetIdx * 4, sheetIdx * 4 + 4) as
              [number | null, number | null, number | null, number | null]
          }
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
  // Try with the elements column first; fall back without it if the column
  // doesn't exist yet in this environment (Designer migration 003 not applied).
  type RawPage = {
    id: string
    page_order: number
    page_type: string
    section_name: string
    section_title: string | null
    paper_color: string | null
    background_type: string | null
    background_color: string | null
    background_opacity: number | null
    background_image_url: string | null
    elements: PageElement[] | null
  }

  const BG_FIELDS = 'paper_color, background_type, background_color, background_opacity, background_image_url'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pagesWithEl, error: elErr } = await (supabase as any)
    .from('passport_pages')
    .select(`id, page_order, page_type, section_name, section_title, ${BG_FIELDS}, elements`)
    .eq('passport_id', passportId)
    .order('page_order', { ascending: true }) as { data: RawPage[] | null; error: unknown }

  let pagesRaw: RawPage[] | null = pagesWithEl

  if (elErr) {
    // elements column absent — retry without it (migration 017 not yet applied)
    console.warn('[print-pdf] elements column unavailable, retrying without it:', elErr)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pagesNoEl, error: pagesErr } = await (supabase as any)
      .from('passport_pages')
      .select(`id, page_order, page_type, section_name, section_title, ${BG_FIELDS}`)
      .eq('passport_id', passportId)
      .order('page_order', { ascending: true }) as { data: Omit<RawPage, 'elements'>[] | null; error: unknown }

    if (pagesErr) {
      return new Response(JSON.stringify({ error: 'Failed to fetch pages' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    pagesRaw = (pagesNoEl ?? []).map((p) => ({ ...p, elements: null }))
  }

  if (!pagesRaw || pagesRaw.length === 0) {
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
        id:                 page.id,
        page_order:         page.page_order,
        page_type:          (page.page_type as 'stamp' | 'information') ?? 'stamp',
        section_name:       page.section_name ?? '',
        section_title:      page.section_title,
        stops:              pageStops,
        elements:           (page.elements ?? []) as PageElement[],
        paper_color:          page.paper_color          ?? 'F5F2EC',
        background_type:      page.background_type      ?? 'guilloche',
        background_color:     page.background_color     ?? '4a6fa5',
        background_opacity:   Math.min(12, Math.max(8, page.background_opacity ?? 10)),
        background_image_url: page.background_image_url ?? null,
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
