import React from 'react'
import { promises as fs } from 'fs'
import path from 'path'
import {
  renderToBuffer, Document, Page, View, Text, StyleSheet,
  Svg, Ellipse, Path, Line, Polyline, Polygon, Rect, Image,
} from '@react-pdf/renderer'
import { createClient } from '@/lib/supabase/server'
import { normalizeAll, normalizeKey, rasterizeSvg, type NormalizeItem } from '@/lib/print/normalize-images'
import { locationCaptionText } from '@/lib/design/location-caption'

// ── Marketing mark loader ────────────────────────────────────────────────────
// The okuji-ground-03 woven-waves PNG used on the free-passport
// discardable strip. Loaded from public/presets/png/ via the Node
// filesystem (process.cwd() is the okujiKobo project root in dev and
// on Vercel). Returns null on failure so the renderer falls back to
// the original full-width instructions instead of breaking PDF
// generation.
let cachedMarkDataUri: string | null | undefined = undefined
async function loadMarketingMark(): Promise<string | null> {
  if (cachedMarkDataUri !== undefined) return cachedMarkDataUri
  try {
    const p = path.join(process.cwd(), 'public', 'presets', 'png', 'okuji-ground-03-woven-waves.png')
    const bytes = await fs.readFile(p)
    cachedMarkDataUri = `data:image/png;base64,${bytes.toString('base64')}`
  } catch (err) {
    console.warn('[print-pdf] marketing mark load failed:', err instanceof Error ? err.message : String(err))
    cachedMarkDataUri = null
  }
  return cachedMarkDataUri
}

// ── Constants ─────────────────────────────────────────────────────────────────
// Resample cap for stamp preview images. Stamps render under an inch in
// the box; a PNG is fully decoded (+ SMask) by pdfkit at render, so this
// bound keeps a passport full of stamps from exhausting function memory.
const STAMP_MAX_DIMENSION = 384
const ARTBOARD_W = 612, ARTBOARD_H = 792
const COVER_DESIGN_W = 1248, COVER_DESIGN_H = 792, COVER_PANEL_W = 612, COVER_SPINE_W = 24
const SHEET_W = 612, SHEET_H = 792
// Strips: horizontal cut at CUT_Y splits sheet into upper/lower strips.
// Each strip has a vertical fold at VERT_FOLD_X giving LEFT/RIGHT reader pages.
const STRIP_H = 396, CUT_Y = STRIP_H
const STRIP_HALF_W = SHEET_W / 2, VERT_FOLD_X = STRIP_HALF_W, CUT_X = STRIP_HALF_W
const PAGE_SLOT_W = STRIP_HALF_W, PAGE_SLOT_H = STRIP_H, PAD = 14

// Scaled artboard for stamp-page slot
const CANVAS_AREA_H = PAGE_SLOT_H - 2 * PAD - 20
const CANVAS_AREA_W = PAGE_SLOT_W - 2 * PAD
const FIT_BY_HEIGHT_W = CANVAS_AREA_H / (ARTBOARD_H / ARTBOARD_W)
const CANVAS_H = CANVAS_AREA_H, CANVAS_W = FIT_BY_HEIGHT_W
const CANVAS_SCALE = CANVAS_H / ARTBOARD_H
const CANVAS_OFFSET_X = (PAGE_SLOT_W - 2 * PAD - CANVAS_W) / 2

// Cover composition area: full sheet width, centered vertically in strip
const COVER_RENDER_W = SHEET_W
const COVER_RENDER_H = (SHEET_W * COVER_DESIGN_H) / COVER_DESIGN_W   // ≈ 388.4
const COVER_Y_OFFSET = (STRIP_H - COVER_RENDER_H) / 2
const COVER_SCALE = COVER_RENDER_W / COVER_DESIGN_W                  // = 612/1248
const COVER_PANEL_W_PT = COVER_PANEL_W * COVER_SCALE                 // ≈ 300.2
const COVER_SPINE_W_PT = COVER_SPINE_W * COVER_SCALE                 // ≈ 11.77

const S = StyleSheet.create({
  sheet: { width: SHEET_W, height: SHEET_H, backgroundColor: '#FFFFFF', position: 'relative' },
  guideH: { position: 'absolute', left: 0, height: 0.5, width: SHEET_W, backgroundColor: '#EEEEEE' },
  regH: { position: 'absolute', height: 0.5, backgroundColor: '#CCCCCC' },
  regV: { position: 'absolute', width: 0.5, backgroundColor: '#CCCCCC' },
  stripLabel: { position: 'absolute', left: 0, width: SHEET_W, textAlign: 'center', fontSize: 6, color: '#888888', fontFamily: 'Helvetica' },
  sheetTag: { position: 'absolute', top: 4, right: 4, fontSize: 6, color: '#999999', fontFamily: 'Helvetica' },
  slot: { position: 'absolute', width: PAGE_SLOT_W, height: PAGE_SLOT_H, overflow: 'hidden', flexDirection: 'column' },
  slotContent: { flex: 1, padding: PAD, flexDirection: 'column', overflow: 'hidden' },
  sectionTitle: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#333333', textAlign: 'center', marginBottom: 4 },
  pageCanvas: { position: 'relative', borderWidth: 0.5, borderColor: '#DDDDDD', borderStyle: 'solid' },
  // Composed stamps render INSIDE the location box (Push 7).
  // Centered flex so the <Svg> sits above the label text without
  // overlapping it visually.
  locationBox: { position: 'absolute', borderWidth: 1, borderColor: '#999999', borderStyle: 'dashed', borderRadius: 2, alignItems: 'center', justifyContent: 'center' },
  locationBoxName: { position: 'absolute', top: 2, left: 0, right: 0, textAlign: 'center', fontSize: 5, color: '#000000', fontFamily: 'Helvetica' },
  // Location caption — small, monochrome, beneath the stamp.
  captionText: { textAlign: 'center', fontSize: 4.5, color: '#555555', fontFamily: 'Helvetica' },
  namePage: { flex: 1, flexDirection: 'column', justifyContent: 'center', paddingHorizontal: 10 },
  nameTitle: { fontSize: 14, fontFamily: 'Helvetica-Bold', color: '#1A1A1A', textAlign: 'center', marginBottom: 24 },
  nameField: { marginBottom: 16 },
  nameLabel: { fontSize: 10, fontFamily: 'Helvetica', color: '#333333', marginBottom: 4 },
  nameLine: { height: 0.5, backgroundColor: '#CCCCCC', width: '100%' },
  nameInstitution: { fontSize: 8, fontFamily: 'Helvetica-Oblique', color: '#666666', textAlign: 'center', marginTop: 20 },
  certInner: { flex: 1, flexDirection: 'column', justifyContent: 'center', paddingHorizontal: 8 },
  certHeading: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#333333', alignSelf: 'center', marginBottom: 6 },
  certTitle: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#1A1A1A', textAlign: 'center', marginBottom: 20 },
  certLabel: { fontSize: 11, color: '#333333', marginBottom: 2 },
  certLine: { height: 0.5, backgroundColor: '#CCCCCC', marginBottom: 14, width: '100%' },
  certLineShort: { height: 0.5, backgroundColor: '#CCCCCC', marginBottom: 14, width: '55%' },
  certMeta: { fontSize: 9, color: '#666666', marginTop: 8, alignSelf: 'center', textAlign: 'center' },
  instrStrip: { position: 'absolute', flexDirection: 'row', alignItems: 'stretch' },
  instrPanel: { flex: 1, flexDirection: 'column', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  instrPanelTitle: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: '#1A1A1A', textAlign: 'center', marginTop: 10 },
  instrPanelText: { fontSize: 9, fontFamily: 'Helvetica', color: '#333333', textAlign: 'center', marginTop: 4 },
  instrLegend: { position: 'absolute', left: 0, width: SHEET_W, textAlign: 'center', fontSize: 8, fontFamily: 'Helvetica', color: '#444444' },
  blankByDesign: { position: 'absolute', left: 0, width: SHEET_W, textAlign: 'center', fontSize: 7, fontFamily: 'Helvetica-Oblique', color: '#BBBBBB' },
})

// Used on structurally-empty strips so the user can tell "intentionally
// blank" apart from "missing content bug". Drawn centered on the strip.
function BlankByDesignLabel({ top, text }: { top: number; text: string }) {
  return <Text style={[S.blankByDesign, { top: top + STRIP_H / 2 - 4 }]}>{text}</Text>
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface StopForPrint {
  id: string; name: string; stop_order: number
  box_x: number; box_y: number; box_width: number; box_height: number; rotation: number
  // Stamp preview (show_stamps): every stamp type resolves to a single
  // image URL rendered in the box. Custom-asset SVGs (incl. composer /
  // vector stamps) are rasterized via librsvg to a data:image/png URI;
  // raster (PNG/JPG) + emoji stamps get a normalized data:image URI.
  // Null when previews are off → blank box.
  stamp_type?: 'emoji' | 'custom_asset' | null
  stamp_color?: string | null
  /** Final image for the stamp: a pre-rasterized data:image/png for
   *  SVG stamps, or a (later-normalized) URL for raster/emoji. Null
   *  when previews are off or the asset couldn't be resolved. */
  stampImageUrl?: string | null
  /** Optional location caption (migration 079), pre-resolved to its
   *  final single line via the shared formatter (null when off / no
   *  data). Rendered beneath the stamp — the stamp is topmost. */
  caption?: string | null
  captionPlacement?: 'interior' | 'exterior'
}
interface BaseElement { id: string; x: number; y: number; width: number; height: number }
interface TextPageElement extends BaseElement { type: 'text'; content?: string; fontSize?: number; fontWeight?: 'normal' | 'bold'; color?: string; align?: 'left' | 'center' | 'right'; rotation?: number }
interface ImagePageElement extends BaseElement { type: 'image'; imageUrl?: string; opacity?: number; rotation?: number }
// Layout (table/grid) element — same box/url shape as image, but its
// normalization PRESERVES ALPHA (thin-line art sits over the page
// background; flattening onto paper color would occlude it) and the
// SVG source rasterizes at high density so lines stay crisp.
interface LayoutPageElement extends BaseElement { type: 'layout'; imageUrl?: string; opacity?: number; rotation?: number }
interface LinePageElement { id: string; type: 'line'; x1: number; y1: number; x2: number; y2: number; thickness?: number; lineColor?: string }
interface HLinePageElement extends BaseElement { type: 'hline'; thickness?: number; lineColor?: string }
interface VLinePageElement extends BaseElement { type: 'vline'; thickness?: number; lineColor?: string }
type PageElement = TextPageElement | ImagePageElement | LayoutPageElement | LinePageElement | HLinePageElement | VLinePageElement

interface PassportPageForPrint {
  id: string; page_order: number; page_type: 'stamp' | 'information'
  section_name: string; section_title: string | null
  stops: StopForPrint[]; elements: PageElement[]
  paper_color: string; background_type: string; background_color: string
  background_opacity: number; custom_background_opacity: number
  background_image_url: string | null
}

interface CoverSideData {
  front_bg: string; back_bg: string; image_url: string | null
  image_opacity: number; image_position_x: number; image_position_y: number; image_scale: number
  elements: PageElement[]
}

type PassportType = 'location' | 'experience' | 'learning'

type ReaderPage =
  | { kind: 'name'; passportTitle: string; institutionName: string; passportType: PassportType }
  | { kind: 'stamp'; page: PassportPageForPrint; pageNum: number }
  | { kind: 'cert'; passportTitle: string; institutionName: string }
  | { kind: 'blank' }

// ── Helpers ───────────────────────────────────────────────────────────────────
function clampOpacityPct(v: number | null | undefined, def = 100): number {
  const n = typeof v === 'number' ? v : def
  return Math.min(100, Math.max(10, n))
}
function truncateTitle(t: string, max = 60): string { return t.length <= max ? t : t.slice(0, max - 1) + '…' }

// Emoji → Twemoji 72×72 PNG URL. @react-pdf's built-in fonts have no
// emoji glyphs, so emoji stamps can't render as text; we map the
// emoji's codepoints to its Twemoji asset and run that PNG through the
// same fetch/flatten/normalize pipeline as raster stamps. Codepoint
// rule matches twemoji's own: join hex codepoints with '-', dropping
// the FE0F variation selector on multi-codepoint sequences. Returns
// null for an empty/invalid string; a failed fetch later degrades to a
// blank box, same as a missing SVG.
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

// Image-handling note: every image URL in the doc data (cover image,
// cover-side elements, page backgrounds, page-element images) is
// pre-processed in the route handler before render — fetched, alpha
// flattened onto the paper color, re-encoded as baseline JPEG, and
// replaced with a `data:image/jpeg;base64,...` URL. The components
// below just consume the URL string as before; pdfkit's PNG-decoder
// gaps (16-bit, Adam7 interlace, ICC profiles, certain alpha/palette
// combos) never come into play because every image is delivered as
// baseline JPEG. URLs that failed to normalize are nulled out so the
// slot renders blank rather than a broken image.
//
// Exception: stamp preview images normalize with preserveAlpha — they
// keep transparency and come back as a clean 8-bit RGBA `data:image/
// png;base64,...` URL (the pdfkit-safe PNG subset), so a transparent
// stamp sits over the page background without a paper-colored box.
//
// (Earlier attempt used React.createContext to propagate the normalized
// buffers, but Next.js 14 App Router compiles API routes against
// react-server which omits createContext. The pre-processing approach
// is also simpler — no provider, no prop drilling.)

// ── Page-element renderers ────────────────────────────────────────────────────
function TextEl({ el, scale }: { el: TextPageElement; scale: number }) {
  const color = `#${el.color ?? '0D1B2A'}`
  const fontSize = (el.fontSize ?? 14) * scale
  const fontFamily = el.fontWeight === 'bold' ? 'Helvetica-Bold' : 'Helvetica'
  const textAlign = el.align ?? 'left'
  const rotation = el.rotation ?? 0
  return (
    <View style={{ position: 'absolute', left: el.x * scale, top: el.y * scale, width: el.width * scale, height: el.height * scale, overflow: 'hidden', transform: rotation ? `rotate(${rotation}deg)` : undefined }}>
      <Text style={{ fontSize, fontFamily, color, textAlign }}>{el.content ?? ''}</Text>
    </View>
  )
}

function ImageEl({ el, scale }: { el: ImagePageElement; scale: number }) {
  if (!el.imageUrl) return null
  const rotation = el.rotation ?? 0
  return (
    <View style={{ position: 'absolute', left: el.x * scale, top: el.y * scale, width: el.width * scale, height: el.height * scale, overflow: 'hidden', transform: rotation ? `rotate(${rotation}deg)` : undefined, opacity: (el.opacity ?? 100) / 100 }}>
      <Image src={el.imageUrl} style={{ width: el.width * scale, height: el.height * scale, objectFit: 'contain' }} />
    </View>
  )
}

function LineEl({ el, scale }: { el: LinePageElement; scale: number }) {
  const thickness = el.thickness ?? 2
  const color = `#${el.lineColor ?? '0D1B2A'}`
  const minX = Math.min(el.x1, el.x2), minY = Math.min(el.y1, el.y2)
  const svgW = Math.abs(el.x2 - el.x1) + thickness * 2
  const svgH = Math.abs(el.y2 - el.y1) + thickness * 2
  const offX = minX - thickness
  return (
    <Svg viewBox={`${offX} ${minY - thickness} ${svgW} ${svgH}`} style={{ position: 'absolute', left: (minX - thickness) * scale, top: (minY - thickness) * scale, width: svgW * scale, height: svgH * scale }}>
      <Line x1={el.x1} y1={el.y1} x2={el.x2} y2={el.y2} stroke={color} strokeWidth={thickness} strokeOpacity={1} />
    </Svg>
  )
}

function HLineEl({ el, scale }: { el: HLinePageElement; scale: number }) {
  const thickness = el.thickness ?? 2
  const color = `#${el.lineColor ?? '0D1B2A'}`
  return <View style={{ position: 'absolute', left: el.x * scale, top: (el.y + el.height / 2 - thickness / 2) * scale, width: el.width * scale, height: thickness * scale, backgroundColor: color }} />
}

function VLineEl({ el, scale }: { el: VLinePageElement; scale: number }) {
  const thickness = el.thickness ?? 2
  const color = `#${el.lineColor ?? '0D1B2A'}`
  return <View style={{ position: 'absolute', left: (el.x + el.width / 2 - thickness / 2) * scale, top: el.y * scale, width: thickness * scale, height: el.height * scale, backgroundColor: color }} />
}

function PageElementsLayer({ elements, scale }: { elements: PageElement[]; scale: number }) {
  return (
    <>
      {(elements ?? []).map((el) => {
        try {
          if (el.type === 'text') return <TextEl key={el.id} el={el} scale={scale} />
          if (el.type === 'image') return <ImageEl key={el.id} el={el} scale={scale} />
          // Same slot render as image; the type difference matters in the
          // normalize queue (alpha preserved, high-density rasterization).
          if (el.type === 'layout') return <ImageEl key={el.id} el={el as unknown as ImagePageElement} scale={scale} />
          if (el.type === 'line') return <LineEl key={el.id} el={el} scale={scale} />
          if (el.type === 'hline') return <HLineEl key={el.id} el={el} scale={scale} />
          if (el.type === 'vline') return <VLineEl key={el.id} el={el} scale={scale} />
        } catch {}
        return null
      })}
    </>
  )
}

// ── Background overlays ──────────────────────────────────────────────────────
function GuillocheOverlay({ color, opacity }: { color: string; opacity: number }) {
  const tileSize = 32
  const cols = Math.ceil(ARTBOARD_W / tileSize) + 1
  const rows = Math.ceil(ARTBOARD_H / tileSize) + 1
  const strokeOpacity = Math.max(10, Math.min(100, opacity)) / 100
  const tiles: React.ReactNode[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * tileSize, y = r * tileSize, cx = x + 16, cy = y + 16, ts = tileSize
      tiles.push(
        <React.Fragment key={`${r}-${c}`}>
          <Ellipse cx={cx} cy={cy} rx={14} ry={7} strokeWidth={0.6} stroke={color} fill="none" strokeOpacity={strokeOpacity} />
          <Ellipse cx={cx} cy={cy} rx={7} ry={14} strokeWidth={0.6} stroke={color} fill="none" strokeOpacity={strokeOpacity} />
          <Path d={`M${cx},${y+2} L${x+ts-2},${cy} L${cx},${y+ts-2} L${x+2},${cy} Z`} strokeWidth={0.4} stroke={color} fill="none" strokeOpacity={strokeOpacity} />
        </React.Fragment>,
      )
    }
  }
  return <Svg viewBox={`0 0 ${ARTBOARD_W} ${ARTBOARD_H}`} style={{ position: 'absolute', top: 0, left: 0, width: CANVAS_W, height: CANVAS_H }}>{tiles}</Svg>
}

function GridOverlay({ color, opacity }: { color: string; opacity: number }) {
  const minor = 12, major = 60
  const minorOpacity = Math.max(10, Math.min(100, opacity)) / 100
  const majorOpacity = Math.min(1, minorOpacity * 2.5)
  const lines: React.ReactNode[] = []
  for (let x = 0; x <= ARTBOARD_W; x += minor) {
    const isMajor = x % major === 0
    lines.push(<Line key={`v${x}`} x1={x} y1={0} x2={x} y2={ARTBOARD_H} stroke={color} strokeWidth={isMajor ? 0.8 : 0.35} strokeOpacity={isMajor ? majorOpacity : minorOpacity} />)
  }
  for (let y = 0; y <= ARTBOARD_H; y += minor) {
    const isMajor = y % major === 0
    lines.push(<Line key={`h${y}`} x1={0} y1={y} x2={ARTBOARD_W} y2={y} stroke={color} strokeWidth={isMajor ? 0.8 : 0.35} strokeOpacity={isMajor ? majorOpacity : minorOpacity} />)
  }
  return <Svg viewBox={`0 0 ${ARTBOARD_W} ${ARTBOARD_H}`} style={{ position: 'absolute', top: 0, left: 0, width: CANVAS_W, height: CANVAS_H }}>{lines}</Svg>
}

// ── Stamp page slot ───────────────────────────────────────────────────────────
function PassportPageSlotContent({ page }: { page: PassportPageForPrint }) {
  // The label that used to render above each passport page was
  // removed — users add their own header inside the page itself
  // when they want one. Keeps `label` derivation intact in case
  // we want it back as an accessible-name source later.
  void page.section_title; void page.section_name; void page.page_order
  const paperColor = `#${page.paper_color ?? 'F5F2EC'}`
  const bgColor = `#${page.background_color ?? '0D1B2A'}`
  const bgOpacity = clampOpacityPct(page.background_opacity)
  const customBgOpacity = clampOpacityPct(page.custom_background_opacity)
  return (
    <>
      <View style={[S.pageCanvas, { width: CANVAS_W, height: CANVAS_H, marginLeft: CANVAS_OFFSET_X, backgroundColor: paperColor }]}>
        {page.background_type === 'guilloche' && <GuillocheOverlay color={bgColor} opacity={bgOpacity} />}
        {page.background_type === 'grid' && <GridOverlay color={bgColor} opacity={bgOpacity} />}
        {(page.background_type === 'custom' || page.background_type === 'okuji') && page.background_image_url && (
          <Image src={page.background_image_url} style={{ position: 'absolute', top: 0, left: 0, width: CANVAS_W, height: CANVAS_H, objectFit: 'contain', opacity: customBgOpacity / 100 }} />
        )}
        <PageElementsLayer elements={page.elements} scale={CANVAS_SCALE} />
        {page.stops.map((stop) => {
          const x = stop.box_x * CANVAS_SCALE, y = stop.box_y * CANVAS_SCALE
          const w = stop.box_width * CANVAS_SCALE, h = stop.box_height * CANVAS_SCALE
          // Stamp previews (show_stamps): one image per stamp — SVG
          // stamps are pre-rasterized (data:image/png), raster/emoji
          // arrive as a normalized data:image URI. Null → blank box for
          // the collector to physically stamp into.
          const stampImageNode = stop.stampImageUrl
            ? <Image src={stop.stampImageUrl} style={{ width: w * 0.7, height: h * 0.7, objectFit: 'contain' }} />
            : null
          return (
            <React.Fragment key={stop.id}>
              <View style={[S.locationBox, { left: x, top: y, width: w, height: h, transform: stop.rotation ? `rotate(${stop.rotation}deg)` : undefined }]}>
                {/* Base layer: pre-printed name + (interior) caption. */}
                <Text style={S.locationBoxName}>{stop.name}</Text>
                {stop.caption && stop.captionPlacement === 'interior' && (
                  <Text style={[S.captionText, { position: 'absolute', bottom: 1, left: 0, right: 0 }]}>{stop.caption}</Text>
                )}
                {/* Top layer: the stamp — ink stamped over the printed page. */}
                {stampImageNode}
              </View>
              {/* Exterior caption sits just below the box. */}
              {stop.caption && stop.captionPlacement === 'exterior' && (
                <Text style={[S.captionText, { position: 'absolute', left: x, top: y + h + 1, width: w }]}>{stop.caption}</Text>
              )}
            </React.Fragment>
          )
        })}
      </View>
    </>
  )
}

// ── Name page ─────────────────────────────────────────────────────────────────
function NamePageContent({ passportTitle, institutionName, passportType }: { passportTitle: string; institutionName: string; passportType: PassportType }) {
  const labels = passportType === 'learning' ? ['Name', 'Date', 'Class', 'Teacher'] : ['Name', 'Date', 'Group']
  return (
    <View style={S.namePage}>
      <Text style={S.nameTitle}>{passportTitle}</Text>
      {labels.map((label) => (
        <View key={label} style={S.nameField}>
          <Text style={S.nameLabel}>{label}</Text>
          <View style={S.nameLine} />
        </View>
      ))}
      {institutionName ? <Text style={S.nameInstitution}>{institutionName}</Text> : null}
    </View>
  )
}

// ── Certificate page ──────────────────────────────────────────────────────────
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

// ── Cover composition ─────────────────────────────────────────────────────────
function CoverCompositionContent({ side, fallbackTitle, paperColor }: { side: CoverSideData | null; fallbackTitle: string; paperColor: string }) {
  if (!side) {
    return (
      <View style={{ position: 'absolute', left: 0, top: COVER_Y_OFFSET, width: COVER_RENDER_W, height: COVER_RENDER_H, backgroundColor: paperColor, alignItems: 'center', justifyContent: 'center' }}>
        {fallbackTitle ? <Text style={{ fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#1A1A1A', textAlign: 'center', paddingHorizontal: 24 }}>{fallbackTitle}</Text> : null}
      </View>
    )
  }
  const imgScale = typeof side.image_scale === 'number' && side.image_scale > 0 ? side.image_scale : 1
  const imgOpacity = typeof side.image_opacity === 'number' ? Math.max(0, Math.min(100, side.image_opacity)) / 100 : 0.8
  const px = Math.max(0, Math.min(1, side.image_position_x ?? 0.5))
  const py = Math.max(0, Math.min(1, side.image_position_y ?? 0.5))
  const imgW = COVER_RENDER_W * imgScale, imgH = COVER_RENDER_H * imgScale
  const imgLeft = (COVER_RENDER_W - imgW) * px
  const imgTop = (COVER_RENDER_H - imgH) * py
  return (
    <View style={{ position: 'absolute', left: 0, top: COVER_Y_OFFSET, width: COVER_RENDER_W, height: COVER_RENDER_H, overflow: 'hidden' }}>
      {/* Back panel (left in print space) */}
      <View style={{ position: 'absolute', left: 0, top: 0, width: COVER_PANEL_W_PT, height: COVER_RENDER_H, backgroundColor: `#${side.back_bg ?? '0D1B2A'}` }} />
      {/* Front panel (right) */}
      <View style={{ position: 'absolute', left: COVER_PANEL_W_PT + COVER_SPINE_W_PT, top: 0, width: COVER_PANEL_W_PT, height: COVER_RENDER_H, backgroundColor: `#${side.front_bg ?? '0D1B2A'}` }} />
      {/* Spine gutter left transparent. Optional full-bleed image: */}
      {side.image_url ? (
        <View style={{ position: 'absolute', left: 0, top: 0, width: COVER_RENDER_W, height: COVER_RENDER_H, overflow: 'hidden', opacity: imgOpacity }}>
          <Image src={side.image_url} style={{ position: 'absolute', left: imgLeft, top: imgTop, width: imgW, height: imgH, objectFit: 'cover' }} />
        </View>
      ) : null}
      <PageElementsLayer elements={side.elements ?? []} scale={COVER_SCALE} />
    </View>
  )
}

// ── Instruction icons ─────────────────────────────────────────────────────────
function CutIcon() {
  return (
    <Svg width={56} height={32} viewBox="0 0 56 32">
      <Line x1={4} y1={16} x2={48} y2={16} stroke="#333333" strokeWidth={1} strokeDasharray="3,2" />
      <Polygon points="48,12 54,16 48,20 50,16" fill="#333333" />
    </Svg>
  )
}
function StackIcon() {
  return (
    <Svg width={48} height={32} viewBox="0 0 48 32">
      <Rect x={6} y={6} width={36} height={5} stroke="#333333" strokeWidth={0.8} fill="#FFFFFF" />
      <Rect x={6} y={14} width={36} height={5} stroke="#333333" strokeWidth={0.8} fill="#FFFFFF" />
      <Rect x={6} y={22} width={36} height={5} stroke="#333333" strokeWidth={0.8} fill="#FFFFFF" />
    </Svg>
  )
}
function FoldIcon() {
  return (
    <Svg width={48} height={36} viewBox="0 0 48 36">
      <Rect x={6} y={4} width={36} height={26} stroke="#333333" strokeWidth={0.8} fill="#FFFFFF" />
      <Line x1={24} y1={4} x2={24} y2={30} stroke="#333333" strokeWidth={0.8} strokeDasharray="2,2" />
      <Polyline points="20,34 24,30 28,34" stroke="#333333" strokeWidth={0.8} fill="none" />
    </Svg>
  )
}
function StapleIcon() {
  return (
    <Svg width={48} height={32} viewBox="0 0 48 32">
      <Path d="M8 6 L8 24 L40 24 L40 6" stroke="#333333" strokeWidth={1} fill="none" />
      <Ellipse cx={14} cy={15} rx={1.4} ry={1.4} fill="#333333" />
      <Ellipse cx={24} cy={15} rx={1.4} ry={1.4} fill="#333333" />
      <Ellipse cx={34} cy={15} rx={1.4} ry={1.4} fill="#333333" />
    </Svg>
  )
}

function InstructionStrip({ top, left = 0, width = SHEET_W }: { top: number; left?: number; width?: number }) {
  const panels = [
    { Icon: CutIcon, title: '1. Cut', body: 'Cut along the horizontal line on every sheet' },
    { Icon: StackIcon, title: '2. Stack', body: 'Stack strips in numbered order (lowest on top)' },
    { Icon: FoldIcon, title: '3. Fold', body: 'Fold the stack along the vertical center line' },
    { Icon: StapleIcon, title: '4. Staple', body: 'Staple three times through the fold' },
  ]
  return (
    <>
      <View style={[S.instrStrip, { left, top, width, height: STRIP_H - 28 }]}>
        {panels.map((p, i) => (
          <View key={i} style={S.instrPanel}>
            <p.Icon />
            <Text style={S.instrPanelTitle}>{p.title}</Text>
            <Text style={S.instrPanelText}>{p.body}</Text>
          </View>
        ))}
      </View>
      <Text style={[S.instrLegend, { left, top: top + STRIP_H - 24, width }]}>
        Print at 100% scale  ·  Duplex: long-edge / book  ·  Portrait orientation
      </Text>
    </>
  )
}

// ── Marketing strip (left half, free-passport only) ──────────────────────────
// Free passports — printed by anyone via Explore — get a small marketing
// block on the discardable cut-off strip. The strip is cut and thrown
// out after assembly, so the marketing is high-visibility-then-gone:
// people see it, print, cut, and toss it (or save it as a bookmark, or
// share it). Paid passports keep the original full-width instructions.
//
// Background is okuji-ground-03-woven-waves.png — the banknote-style
// woven design with the okuji wordmark centered. URL goes below.
function MarketingStrip({
  top, left, width, height, imageDataUri,
}: {
  top: number; left: number; width: number; height: number
  imageDataUri: string | null
}) {
  return (
    <View
      style={{
        position: 'absolute',
        left, top, width, height,
        overflow: 'hidden',
      }}
    >
      {imageDataUri && (
        <Image
          src={imageDataUri}
          style={{
            position: 'absolute',
            left: 0,
            top: -(height * 0.22),  // shift up so the wordmark sits in the visible window
            width,
            height: width * (792 / 612),
          }}
        />
      )}
      <Text
        style={{
          position: 'absolute',
          bottom: 18,
          left: 0,
          width,
          textAlign: 'center',
          fontSize: 9,
          fontFamily: 'Helvetica',
          color: '#1F1D1A',
        }}
      >
        https://okujikobo.okuji.app
      </Text>
      <Text
        style={{
          position: 'absolute',
          bottom: 6,
          left: 0,
          width,
          textAlign: 'center',
          fontSize: 6,
          fontFamily: 'Helvetica',
          color: '#6B6356',
        }}
      >
        Designed with Okuji · printable passports for real adventures
      </Text>
    </View>
  )
}

// ── Duplex check pattern (sheet 1 upper-strip side B) ────────────────────────
function DuplexCheckStrip({ top }: { top: number }) {
  return (
    <View style={{ position: 'absolute', left: 0, top, width: SHEET_W, height: STRIP_H, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={SHEET_W * 0.4} height={STRIP_H * 0.4} viewBox="0 0 200 200">
        <Rect x={10} y={10} width={180} height={180} stroke="#CCCCCC" strokeWidth={0.5} fill="none" />
        <Line x1={10} y1={100} x2={190} y2={100} stroke="#DDDDDD" strokeWidth={0.5} />
        <Line x1={100} y1={10} x2={100} y2={190} stroke="#DDDDDD" strokeWidth={0.5} />
        <Path d="M100,40 L130,100 L100,160 L70,100 Z" stroke="#888888" strokeWidth={0.8} fill="none" />
      </Svg>
      <Text style={{ marginTop: 12, fontSize: 9, fontFamily: 'Helvetica-Oblique', color: '#888888' }}>
        verify duplex: long-edge flip
      </Text>
    </View>
  )
}

// ── Bindery aids ──────────────────────────────────────────────────────────────
// Keep cut/fold marks at least 0.5" (36pt) away from every sheet edge.
// Inks too close to the edge get trimmed by the printer's unprintable
// margin, and visually they crowd the cut/fold work area.
const BINDERY_MARGIN = 36

function CutGuide() {
  return (
    <View
      style={{
        position: 'absolute',
        left: BINDERY_MARGIN,
        top: CUT_Y - 0.25,
        width: SHEET_W - BINDERY_MARGIN * 2,
        height: 0.5,
        backgroundColor: '#EEEEEE',
      }}
    />
  )
}

function FoldGuide({ top }: { top: number }) {
  // Upper strip (top=0): inset from the sheet's top edge.
  // Lower strip (top=CUT_Y): inset from the sheet's bottom edge.
  // The interior end (the CUT_Y horizon) runs flush so the fold
  // reads continuously across the cut on each strip.
  const isUpperStrip = top === 0
  const renderTop = top + (isUpperStrip ? BINDERY_MARGIN : 0)
  const renderH   = STRIP_H - BINDERY_MARGIN
  return (
    <Svg
      style={{ position: 'absolute', left: VERT_FOLD_X - 1, top: renderTop, width: 2, height: renderH }}
      width={2} height={renderH} viewBox={`0 0 2 ${renderH}`}
    >
      <Line x1={1} y1={0} x2={1} y2={renderH} stroke="#DDDDDD" strokeWidth={0.5} strokeDasharray="3,3" />
    </Svg>
  )
}

function RegistrationMarks({ skipVertical }: { skipVertical: boolean }) {
  const len = 16, half = len / 2
  // Anchor each mark BINDERY_MARGIN in from the sheet edge it
  // references. Marks at the page edge proper extend 8pt past it and
  // trip @react-pdf's wrap, emitting a phantom continuation page.
  const positions: { x: number; y: number }[] = [
    { x: BINDERY_MARGIN,            y: CUT_Y },
    { x: SHEET_W - BINDERY_MARGIN,  y: CUT_Y },
  ]
  if (!skipVertical) {
    positions.push({ x: CUT_X, y: BINDERY_MARGIN })
    positions.push({ x: CUT_X, y: SHEET_H - BINDERY_MARGIN })
  }
  return (
    <>
      {positions.map((pos, i) => (
        <React.Fragment key={i}>
          <View style={[S.regH, { left: pos.x - half, top: pos.y - 0.25, width: len }]} />
          <View style={[S.regV, { left: pos.x - 0.25, top: pos.y - half, height: len }]} />
        </React.Fragment>
      ))}
    </>
  )
}

function StripLabel({ stripPosition, totalStrips, passportTitle, stripIndex }: { stripPosition: number; totalStrips: number; passportTitle: string; stripIndex: 0 | 1 }) {
  const directional = stripPosition === 1 ? '▼ Place on top' : '▲ Place underneath previous'
  const title = truncateTitle(passportTitle, 60)
  const text = `STRIP ${stripPosition} of ${totalStrips} — ${title} · ${directional}`
  const top = stripIndex === 0 ? 2 : STRIP_H + 2
  return <Text style={[S.stripLabel, { top }]}>{text}</Text>
}

// ── Reader-page slot wrapper ──────────────────────────────────────────────────
function ReaderPageSlot({ page, left, top }: { page: ReaderPage; left: number; top: number }) {
  return (
    <View style={[S.slot, { left, top }]}>
      <View style={S.slotContent}>
        {page.kind === 'name' && <NamePageContent passportTitle={page.passportTitle} institutionName={page.institutionName} passportType={page.passportType} />}
        {page.kind === 'stamp' && <PassportPageSlotContent page={page.page} />}
        {page.kind === 'cert' && <CertSlotContent title={page.passportTitle} institutionName={page.institutionName} />}
        {page.kind === 'blank' && (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 7, fontFamily: 'Helvetica-Oblique', color: '#BBBBBB' }}>
              Blank by design — pads to signature
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}

// ── Imposition ────────────────────────────────────────────────────────────────
// For signature k (1-indexed) in a booklet of P_padded reader pages:
//   outerRight = 2k − 1          (TR on side A)
//   outerLeft  = P_padded − 2k + 2  (TL on side A)
//   innerLeft  = P_padded − 2k + 1  (TR on side B in B's reading view)
//   innerRight = 2k                (TL on side B in B's reading view)
//
// PDF coords (side B rendered as the next page; long-edge flip puts it behind A):
//   SBQ1 at (0, 0)            → innerRight (page 2k)
//   SBQ2 at (STRIP_HALF_W, 0) → innerLeft  (page P_padded − 2k + 1)
//   SBQ3 at (0, CUT_Y)        → innerRight
//   SBQ4 at (STRIP_HALF_W, CUT_Y) → innerLeft

interface SignatureSlots {
  sideA_left: ReaderPage    // SAQ1/3 at (0, stripTop)
  sideA_right: ReaderPage   // SAQ2/4 at (STRIP_HALF_W, stripTop)
  sideB_left: ReaderPage    // SBQ1/3 at (0, stripTop)
  sideB_right: ReaderPage   // SBQ2/4 at (STRIP_HALF_W, stripTop)
}

function signatureSlots(k: number, pPadded: number, readerPages: ReaderPage[]): SignatureSlots {
  const idxOuterLeft = pPadded - 2 * k + 2
  const idxOuterRight = 2 * k - 1
  const idxInnerLeft = pPadded - 2 * k + 1
  const idxInnerRight = 2 * k
  const getPage = (i: number): ReaderPage => readerPages[i - 1] ?? { kind: 'blank' }
  return {
    sideA_left:  getPage(idxOuterLeft),
    sideA_right: getPage(idxOuterRight),
    sideB_left:  getPage(idxInnerRight),
    sideB_right: getPage(idxInnerLeft),
  }
}

// ── Sheet plan ────────────────────────────────────────────────────────────────
interface StampSheet { kind: 'stamp'; upperSignatureK: number | null; lowerSignatureK: number | null }
interface CoverSheet { kind: 'cover' }
type SheetPlan = CoverSheet | StampSheet

function planSheets(numSignatures: number): SheetPlan[] {
  const plan: SheetPlan[] = [{ kind: 'cover' }]
  let k = 1
  while (k <= numSignatures) {
    const upperK = k
    const lowerK = k + 1 <= numSignatures ? k + 1 : null
    plan.push({ kind: 'stamp', upperSignatureK: upperK, lowerSignatureK: lowerK })
    k += 2
  }
  return plan
}

// ── Sheet rendering ───────────────────────────────────────────────────────────
interface RenderContext {
  passportTitle: string; institutionName: string; passportType: PassportType
  readerPages: ReaderPage[]; pPadded: number; numSignatures: number
  totalSheets: number; totalStrips: number
  outsideCover: CoverSideData | null; insideCover: CoverSideData | null
  paperColorHex: string
  /** Set when the passport is FREE — drives the split top strip
   *  (left half = marketing, right half = instructions) on cover
   *  sheet side A. Null on paid passports keeps the original
   *  full-width instructions. */
  marketingImageDataUri: string | null
}

function CoverSheetSideA({ ctx, sheetIndex }: { ctx: RenderContext; sheetIndex: number }) {
  // Free passports: split the discardable top strip in half. The cut
  // line is unchanged at CUT_Y; both halves get cut off together
  // post-print. Paid passports keep the full-width instructions.
  const splitStrip = ctx.marketingImageDataUri !== null
  return (
    <Page size={[SHEET_W, SHEET_H]} style={S.sheet}>
      <CutGuide />
      <FoldGuide top={CUT_Y} />
      <RegistrationMarks skipVertical={true} />
      <Text style={S.sheetTag}>{`Sheet ${sheetIndex + 1} / ${ctx.totalSheets}`}</Text>
      {splitStrip ? (
        <>
          {/* 0.5" margin on top + left so the okuji throw-away
              page sits inside the paper sheet's printable area
              with no bleed. Right edge stays at the centerfold
              (SHEET_W / 2) and bottom edge stays at the cut
              line (STRIP_H) — only the top + left edges pull
              away from the sheet edge. 36pt = 0.5" at 72 dpi. */}
          <MarketingStrip
            top={36}
            left={36}
            width={SHEET_W / 2 - 36}
            height={STRIP_H - 36}
            imageDataUri={ctx.marketingImageDataUri}
          />
          <InstructionStrip top={0} left={SHEET_W / 2} width={SHEET_W / 2} />
        </>
      ) : (
        <InstructionStrip top={0} />
      )}
      <View style={{ position: 'absolute', left: 0, top: CUT_Y, width: SHEET_W, height: STRIP_H }}>
        <CoverCompositionContent side={ctx.outsideCover} fallbackTitle={ctx.passportTitle} paperColor={ctx.paperColorHex} />
      </View>
      <StripLabel stripPosition={1} totalStrips={ctx.totalStrips} passportTitle={ctx.passportTitle} stripIndex={1} />
    </Page>
  )
}

function CoverSheetSideB({ ctx, sheetIndex }: { ctx: RenderContext; sheetIndex: number }) {
  return (
    <Page size={[SHEET_W, SHEET_H]} style={S.sheet}>
      <CutGuide />
      <FoldGuide top={CUT_Y} />
      <RegistrationMarks skipVertical={true} />
      <Text style={S.sheetTag}>{`Sheet ${sheetIndex + 1} / ${ctx.totalSheets} (back)`}</Text>
      <DuplexCheckStrip top={0} />
      <View style={{ position: 'absolute', left: 0, top: CUT_Y, width: SHEET_W, height: STRIP_H }}>
        <CoverCompositionContent side={ctx.insideCover} fallbackTitle="" paperColor={ctx.paperColorHex} />
      </View>
    </Page>
  )
}

function StampSheetSideA({ ctx, sheet, sheetIndex }: { ctx: RenderContext; sheet: StampSheet; sheetIndex: number }) {
  const upperK = sheet.upperSignatureK, lowerK = sheet.lowerSignatureK
  const upperStripPos = upperK !== null ? upperK + 1 : null
  const lowerStripPos = lowerK !== null ? lowerK + 1 : null
  const upperSlots = upperK !== null ? signatureSlots(upperK, ctx.pPadded, ctx.readerPages) : null
  const lowerSlots = lowerK !== null ? signatureSlots(lowerK, ctx.pPadded, ctx.readerPages) : null
  return (
    <Page size={[SHEET_W, SHEET_H]} style={S.sheet}>
      <CutGuide />
      <FoldGuide top={0} />
      <FoldGuide top={CUT_Y} />
      <RegistrationMarks skipVertical={false} />
      <Text style={S.sheetTag}>{`Sheet ${sheetIndex + 1} / ${ctx.totalSheets}`}</Text>
      {upperSlots && (
        <>
          <ReaderPageSlot page={upperSlots.sideA_left}  left={0}            top={0} />
          <ReaderPageSlot page={upperSlots.sideA_right} left={STRIP_HALF_W} top={0} />
          {upperStripPos !== null && <StripLabel stripPosition={upperStripPos} totalStrips={ctx.totalStrips} passportTitle={ctx.passportTitle} stripIndex={0} />}
        </>
      )}
      {lowerSlots && (
        <>
          <ReaderPageSlot page={lowerSlots.sideA_left}  left={0}            top={CUT_Y} />
          <ReaderPageSlot page={lowerSlots.sideA_right} left={STRIP_HALF_W} top={CUT_Y} />
          {lowerStripPos !== null && <StripLabel stripPosition={lowerStripPos} totalStrips={ctx.totalStrips} passportTitle={ctx.passportTitle} stripIndex={1} />}
        </>
      )}
      {!lowerSlots && <BlankByDesignLabel top={CUT_Y} text="Blank by design — cut and discard" />}
    </Page>
  )
}

function StampSheetSideB({ ctx, sheet, sheetIndex }: { ctx: RenderContext; sheet: StampSheet; sheetIndex: number }) {
  const upperK = sheet.upperSignatureK, lowerK = sheet.lowerSignatureK
  const upperSlots = upperK !== null ? signatureSlots(upperK, ctx.pPadded, ctx.readerPages) : null
  const lowerSlots = lowerK !== null ? signatureSlots(lowerK, ctx.pPadded, ctx.readerPages) : null
  return (
    <Page size={[SHEET_W, SHEET_H]} style={S.sheet}>
      <CutGuide />
      <FoldGuide top={0} />
      <FoldGuide top={CUT_Y} />
      <RegistrationMarks skipVertical={false} />
      <Text style={S.sheetTag}>{`Sheet ${sheetIndex + 1} / ${ctx.totalSheets} (back)`}</Text>
      {upperSlots && (
        <>
          <ReaderPageSlot page={upperSlots.sideB_left}  left={0}            top={0} />
          <ReaderPageSlot page={upperSlots.sideB_right} left={STRIP_HALF_W} top={0} />
        </>
      )}
      {lowerSlots && (
        <>
          <ReaderPageSlot page={lowerSlots.sideB_left}  left={0}            top={CUT_Y} />
          <ReaderPageSlot page={lowerSlots.sideB_right} left={STRIP_HALF_W} top={CUT_Y} />
        </>
      )}
      {!lowerSlots && <BlankByDesignLabel top={CUT_Y} text="Blank by design — cut and discard" />}
    </Page>
  )
}

// ── Document ──────────────────────────────────────────────────────────────────
interface PrintPassportDocProps {
  passportTitle: string; institutionName: string; passportType: PassportType
  includeCert: boolean
  outsideCover: CoverSideData | null; insideCover: CoverSideData | null
  paperColorHex: string
  stampPages: PassportPageForPrint[]
  marketingImageDataUri: string | null
}

function PrintPassportDoc({ passportTitle, institutionName, passportType, includeCert, outsideCover, insideCover, paperColorHex, stampPages, marketingImageDataUri }: PrintPassportDocProps) {
  const readerPages: ReaderPage[] = []
  readerPages.push({ kind: 'name', passportTitle, institutionName, passportType })
  let pageNum = 1
  for (const page of stampPages) {
    readerPages.push({ kind: 'stamp', page, pageNum: ++pageNum })
  }
  if (includeCert) readerPages.push({ kind: 'cert', passportTitle, institutionName })

  const P = readerPages.length
  const numSignatures = Math.max(1, Math.ceil(P / 4))
  const pPadded = numSignatures * 4
  while (readerPages.length < pPadded) readerPages.push({ kind: 'blank' })

  const plan = planSheets(numSignatures)
  const totalSheets = plan.length
  const totalStrips = 1 + numSignatures

  const ctx: RenderContext = {
    passportTitle, institutionName, passportType,
    readerPages, pPadded, numSignatures, totalSheets, totalStrips,
    outsideCover, insideCover, paperColorHex,
    marketingImageDataUri,
  }

  return (
    <Document>
      {plan.map((sheet, sheetIndex) => {
        if (sheet.kind === 'cover') {
          return (
            <React.Fragment key={`sheet-${sheetIndex}`}>
              <CoverSheetSideA ctx={ctx} sheetIndex={sheetIndex} />
              <CoverSheetSideB ctx={ctx} sheetIndex={sheetIndex} />
            </React.Fragment>
          )
        }
        return (
          <React.Fragment key={`sheet-${sheetIndex}`}>
            <StampSheetSideA ctx={ctx} sheet={sheet} sheetIndex={sheetIndex} />
            <StampSheetSideB ctx={ctx} sheet={sheet} sheetIndex={sheetIndex} />
          </React.Fragment>
        )
      })}
    </Document>
  )
}

// ── K-12 cert logic ───────────────────────────────────────────────────────────
const K12_INSTITUTION_TYPES = new Set([
  'k12_school', 'educational_nonprofit', 'after_school_program',
  'homeschool_cooperative', 'literacy_organization', 'youth_development', 'environmental_education',
])

function decideIncludeCert(passportType: PassportType, institutionType: string | null, printCertificate: boolean | null): boolean {
  if (printCertificate !== null && printCertificate !== undefined) return !!printCertificate
  if (passportType === 'learning') return true
  if (institutionType && K12_INSTITUTION_TYPES.has(institutionType)) return true
  return false
}

// ── Route ─────────────────────────────────────────────────────────────────────
export const dynamic = 'force-dynamic'
// sharp (used by lib/print/normalize-images) requires the Node.js runtime;
// the default Edge runtime would crash on the native binding.
export const runtime = 'nodejs'

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    return await handlePrintRequest(request, params.id)
  } catch (err) {
    console.error('[print-pdf] unhandled error:', err)
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Internal server error' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
}

async function handlePrintRequest(request: Request, passportId: string) {
  const supabase = await createClient()

  // Auth
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } })
  }

  // The request body used to carry stop_ids (selected stops), copies,
  // and journal_override — all gone. The one surviving option is
  // show_stamps: render each stop's stamp image inside its box
  // (preview) vs. leave it blank for collecting. Every stop is still
  // always included; copies are chosen at the printer; journal lines
  // don't render. An empty body keeps the default (show_stamps=false),
  // so older clients posting '{}' behave unchanged.
  let showStamps = false
  try {
    const body = await request.json()
    showStamps = (body as { show_stamps?: unknown })?.show_stamps === true
  } catch { /* empty body is fine — default off */ }

  // Fetch passport
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: passport, error: passportError } = await (supabase as any)
    .from('passports')
    .select('id, title, creator_id, proprietor_id, passport_type, print_certificate, cover_outside_data, cover_inside_data, cover_paper_color, is_published, price_cents')
    .eq('id', passportId)
    .single() as {
      data: {
        id: string; title: string; creator_id: string; proprietor_id: string | null
        passport_type: PassportType | null; print_certificate: boolean | null
        cover_outside_data: CoverSideData | null; cover_inside_data: CoverSideData | null
        cover_paper_color: string | null
        is_published: boolean | null; price_cents: number | null
      } | null
      error: unknown
    }

  if (passportError || !passport) {
    return new Response(JSON.stringify({ error: 'Passport not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
  }

  // Authz — three branches:
  //   1. Creator of the passport.
  //   2. Employee of the passport's proprietor (institutional content).
  //   3. Any authenticated user IFF the passport is PUBLISHED and FREE
  //      (price_cents = 0). This is the "kindergarten teacher finds it
  //      on Explore and prints it" path. Drafts and paid passports are
  //      still gated — only published + price_cents=0 opens up.
  const isCreator         = passport.creator_id === user.id
  const isPublishedAndFree =
    passport.is_published === true && (passport.price_cents ?? 0) === 0
  if (!isCreator && !isPublishedAndFree) {
    if (!passport.proprietor_id) {
      return new Response(JSON.stringify({ error: 'Not authorized to print this passport' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: authz } = await (supabase as any)
      .from('employee_authorizations')
      .select('id')
      .eq('user_id', user.id)
      .eq('institution_id', passport.proprietor_id)
      .maybeSingle()
    if (!authz) {
      return new Response(JSON.stringify({ error: 'Not authorized to print this passport' }), { status: 403, headers: { 'Content-Type': 'application/json' } })
    }
  }

  // Institution name + type
  let institutionName = ''
  let institutionType: string | null = null
  if (passport.proprietor_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inst } = await (supabase as any)
      .from('institutions')
      .select('name, institution_type')
      .eq('id', passport.proprietor_id)
      .single() as { data: { name: string; institution_type: string | null } | null }
    institutionName = inst?.name ?? ''
    institutionType = inst?.institution_type ?? null
  }

  // Fetch pages
  type RawPage = {
    id: string; page_order: number; page_type: string
    section_name: string; section_title: string | null
    paper_color: string | null; background_type: string | null; background_color: string | null
    background_opacity: number | null; custom_background_opacity: number | null
    background_image_url: string | null
    elements: PageElement[] | null
  }
  const BG_FIELDS = 'paper_color, background_type, background_color, background_opacity, custom_background_opacity, background_image_url'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pagesWithEl, error: elErr } = await (supabase as any)
    .from('passport_pages')
    .select(`id, page_order, page_type, section_name, section_title, ${BG_FIELDS}, elements`)
    .eq('passport_id', passportId)
    .order('page_order', { ascending: true }) as { data: RawPage[] | null; error: unknown }

  let pagesRaw: RawPage[] | null = pagesWithEl

  if (elErr) {
    console.warn('[print-pdf] elements column unavailable, retrying without it:', elErr)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: pagesNoEl, error: pagesErr } = await (supabase as any)
      .from('passport_pages')
      .select(`id, page_order, page_type, section_name, section_title, ${BG_FIELDS}`)
      .eq('passport_id', passportId)
      .order('page_order', { ascending: true }) as { data: Omit<RawPage, 'elements'>[] | null; error: unknown }
    if (pagesErr) {
      return new Response(JSON.stringify({ error: 'Failed to fetch pages' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
    }
    pagesRaw = (pagesNoEl ?? []).map((p) => ({ ...p, elements: null }))
  }

  if (!pagesRaw || pagesRaw.length === 0) {
    return new Response(JSON.stringify({ error: 'No pages found for this passport' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
  }

  // Fetch stops
  const pageIds = pagesRaw.map((p) => p.id)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stopsRaw, error: stopsErr } = await (supabase as any)
    .from('stops')
    .select('id, page_id, stop_order, name, box_x, box_y, box_width, box_height, rotation, stamp_type, stamp_color, stamp_asset_id, stamp_icon, location_caption_mode, location_caption_placement, lat, lng, address_street, address_city, address_state, address_zip, country')
    .in('page_id', pageIds)
    .order('stop_order', { ascending: true }) as {
      data: { id: string; page_id: string; stop_order: number; name: string; box_x: number | null; box_y: number | null; box_width: number; box_height: number; rotation: number | null; stamp_type: string | null; stamp_color: string | null; stamp_asset_id: string | null; stamp_icon: string | null; location_caption_mode: string | null; location_caption_placement: string | null; lat: number | null; lng: number | null; address_street: string | null; address_city: string | null; address_state: string | null; address_zip: string | null; country: string | null }[] | null
      error: unknown
    }

  if (stopsErr) {
    return new Response(JSON.stringify({ error: 'Failed to fetch stops' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  // For every stop that points at a custom_asset, batch-fetch
  // the asset row to get its URL + file_format. SVG assets get
  // their text content fetched + cached by URL so multiple
  // stops sharing one stamp asset cost one HTTP round-trip.
  //
  // Skip all of this when previews are off (the default): the boxes
  // render blank, so there's nothing to fetch or normalize.
  const assetIds = showStamps ? Array.from(new Set(
    (stopsRaw ?? [])
      .filter((s) => s.stamp_type === 'custom_asset' && s.stamp_asset_id)
      .map((s) => s.stamp_asset_id as string),
  )) : []
  const assetMap = new Map<string, { url: string | null; file_format: string | null }>()
  if (assetIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: assetRows } = await (supabase as any)
      .from('design_assets')
      .select('id, url, file_format')
      .in('id', assetIds)
    for (const row of (assetRows ?? []) as { id: string; url: string | null; file_format: string | null }[]) {
      assetMap.set(row.id, { url: row.url, file_format: row.file_format })
    }
  }
  // Fetch SVG content for asset URLs that are SVG. Concurrent
  // fetches; failures degrade to null (label-only render).
  const svgUrls = Array.from(assetMap.values())
    .filter((a) => a.url && (a.file_format === 'image/svg+xml' || a.url.toLowerCase().split('?')[0].endsWith('.svg')))
    .map((a) => a.url as string)
  const svgByUrl = new Map<string, string>()
  await Promise.all(svgUrls.map(async (url) => {
    try {
      const res = await fetch(url)
      if (res.ok) svgByUrl.set(url, await res.text())
    } catch { /* keep going; missing stamps render as label-only */ }
  }))

  // Pre-rasterize each (SVG stamp, ink color) once via librsvg. The old
  // inline SVG→@react-pdf translator mis-parsed nested same-tag groups
  // (composer / traced "vector" stamps), silently dropping the artwork;
  // rasterizing renders any valid SVG. Keyed by url+color since two
  // stops can share one asset with different inks.
  const svgRasterByKey = new Map<string, string>()
  if (showStamps && svgByUrl.size > 0) {
    const seen = new Set<string>()
    const tasks: Promise<void>[] = []
    for (const s of (stopsRaw ?? [])) {
      if (s.stamp_type !== 'custom_asset' || !s.stamp_asset_id) continue
      const asset = assetMap.get(s.stamp_asset_id)
      const svg = asset?.url ? svgByUrl.get(asset.url) : undefined
      if (!asset?.url || !svg) continue
      const color = s.stamp_color ?? '1D9E75'
      const key = `${asset.url}::${color}`
      if (seen.has(key)) continue
      seen.add(key)
      const recolored = svg.replace(/currentColor/g, `#${color}`)
      tasks.push(rasterizeSvg(recolored, STAMP_MAX_DIMENSION).then((uri) => { if (uri) svgRasterByKey.set(key, uri) }))
    }
    await Promise.all(tasks)
  }

  // Build per-page data. Every stop is always included now; the old
  // selectedIds filter is gone alongside the modal's stop checkboxes.
  const pagesForPrint: PassportPageForPrint[] = pagesRaw
    .map((page) => {
      const pageStops = (stopsRaw ?? [])
        .filter((s) => s.page_id === page.id)
        .map<StopForPrint>((s) => {
          const asset = s.stamp_asset_id ? assetMap.get(s.stamp_asset_id) ?? null : null
          // One image per stamp (preview mode):
          //   SVG custom asset → pre-rasterized data:image/png (already
          //     final; skipped by the normalize pass).
          //   raster custom asset → raw asset URL (normalized below).
          //   emoji → Twemoji PNG URL (normalized below).
          let stampImageUrl: string | null = null
          if (showStamps) {
            const svg = asset?.url ? svgByUrl.get(asset.url) : undefined
            if (s.stamp_type === 'custom_asset' && asset?.url && svg) {
              stampImageUrl = svgRasterByKey.get(`${asset.url}::${s.stamp_color ?? '1D9E75'}`) ?? null
            } else if (s.stamp_type === 'custom_asset' && asset?.url) {
              stampImageUrl = asset.url
            } else if (s.stamp_type === 'emoji') {
              stampImageUrl = twemojiPngUrl(s.stamp_icon)
            }
          }
          // Resolve the location caption once, server-side, via the
          // shared single-source formatter so print matches kobo + mobile.
          const caption = locationCaptionText(
            s.location_caption_mode as 'off' | 'address' | 'coordinates' | null,
            { lat: s.lat, lng: s.lng, address_street: s.address_street, address_city: s.address_city, address_state: s.address_state, address_zip: s.address_zip, country: s.country },
          )
          return {
            id: s.id, name: s.name, stop_order: s.stop_order,
            box_x: s.box_x ?? 40, box_y: s.box_y ?? 40,
            box_width: s.box_width ?? 120, box_height: s.box_height ?? 120,
            rotation: s.rotation ?? 0,
            stamp_type: (s.stamp_type as 'emoji' | 'custom_asset' | null) ?? null,
            stamp_color: s.stamp_color,
            stampImageUrl,
            caption,
            captionPlacement: (s.location_caption_placement as 'interior' | 'exterior' | null) ?? 'interior',
          }
        })
      return {
        id: page.id,
        page_order: page.page_order,
        page_type: (page.page_type as 'stamp' | 'information') ?? 'stamp',
        section_name: page.section_name ?? '',
        section_title: page.section_title,
        stops: pageStops,
        elements: (page.elements ?? []) as PageElement[],
        paper_color: page.paper_color ?? 'F5F2EC',
        background_type: page.background_type ?? 'guilloche',
        background_color: page.background_color ?? '4a6fa5',
        background_opacity: clampOpacityPct(page.background_opacity),
        custom_background_opacity: clampOpacityPct(page.custom_background_opacity),
        background_image_url: page.background_image_url ?? null,
      }
    })

  // Cert + cover decisions
  const passportType: PassportType = (passport.passport_type ?? 'location') as PassportType
  const includeCert = decideIncludeCert(passportType, institutionType, passport.print_certificate)
  const paperColorHex = `#${passport.cover_paper_color ?? 'F5F2EC'}`

  // ── Pre-normalize every image in the doc ─────────────────────────────────
  // pdfkit's PNG decoder silently drops certain user-uploaded variants
  // (alpha + ICC profile, interlaced, 16-bit, etc.). Fetch every image
  // ahead of render and flatten/re-encode as JPEG so the rendering pass
  // gets a guaranteed-decodable buffer.
  //
  // Each image is normalized against the paper colour it actually
  // sits on — cover images on cover_paper_color, page element images
  // on that page's paper_color. Before this fix every image got the
  // cover paper colour, which made transparent PNGs placed on a white
  // page render with a cream rectangle around them.
  const coverPaperHex = (passport.cover_paper_color ?? 'F5F2EC').replace(/^#/, '')

  const items: NormalizeItem[] = []
  const pushCover = (u: string | null | undefined) => {
    if (u) items.push({ url: u, paperHex: coverPaperHex })
  }
  pushCover(passport.cover_outside_data?.image_url)
  for (const el of passport.cover_outside_data?.elements ?? []) {
    if ((el as { type?: string }).type === 'image') pushCover((el as ImagePageElement).imageUrl)
  }
  pushCover(passport.cover_inside_data?.image_url)
  for (const el of passport.cover_inside_data?.elements ?? []) {
    if ((el as { type?: string }).type === 'image') pushCover((el as ImagePageElement).imageUrl)
  }
  for (const page of pagesForPrint) {
    const pageHex = (page.paper_color ?? 'F5F2EC').replace(/^#/, '')
    if ((page.background_type === 'custom' || page.background_type === 'okuji') && page.background_image_url) {
      items.push({ url: page.background_image_url, paperHex: pageHex })
    }
    for (const el of page.elements ?? []) {
      if (el.type === 'image') {
        const u = (el as ImagePageElement).imageUrl
        if (u) items.push({ url: u, paperHex: pageHex })
      }
      // Layout (table/grid) art: KEEP the alpha — the thin lines sit
      // over the page background/pattern; flattening onto paper color
      // (the image-element default) would occlude everything beneath
      // the table's transparent cells.
      if (el.type === 'layout') {
        const u = (el as LayoutPageElement).imageUrl
        if (u) items.push({ url: u, paperHex: pageHex, preserveAlpha: true })
      }
    }
    // Raster/emoji stamp images (preview mode) — preserve alpha so a
    // transparent PNG stamp (or a Twemoji glyph) sits cleanly over the
    // page background instead of carrying a paper-colored rectangle.
    // Cap the resample small: stamps print under an inch, and a PNG is
    // fully decoded (+ SMask) by pdfkit, so a large one is what blows
    // memory/time on a passport with many stamps.
    for (const stop of page.stops) {
      // SVG stamps are already final data: URIs (pre-rasterized) — only
      // raster/emoji raw URLs go through the normalize pass.
      if (stop.stampImageUrl && !stop.stampImageUrl.startsWith('data:')) {
        items.push({ url: stop.stampImageUrl, paperHex: pageHex, preserveAlpha: true, maxDimension: STAMP_MAX_DIMENSION })
      }
    }
  }

  const normalized = await normalizeAll(items)
  // (normalizeAll logs accurate unique/requested/failure accounting.)

  // Rewrite URLs in the doc data: each original URL becomes the
  // data:image/jpeg;base64,... URL from the normalizer for the specific
  // paper colour it was flattened against, or null if normalization
  // failed (so the component skips rather than rendering a broken slot).
  const remap = (u: string | null | undefined, paperHex: string, preserveAlpha = false): string | null => {
    if (!u) return null
    return normalized.get(normalizeKey(u, paperHex, preserveAlpha)) ?? null
  }
  const remapElements = (els: PageElement[], paperHex: string): PageElement[] =>
    (els ?? []).map((el) => {
      if (el.type === 'image') {
        return { ...el, imageUrl: remap((el as ImagePageElement).imageUrl, paperHex) ?? undefined }
      }
      if (el.type === 'layout') {
        // preserveAlpha key — must match how the queue normalized it.
        return { ...el, imageUrl: remap((el as LayoutPageElement).imageUrl, paperHex, true) ?? undefined }
      }
      return el
    })
  const remapCover = (side: CoverSideData | null): CoverSideData | null => {
    if (!side) return null
    return {
      ...side,
      image_url: remap(side.image_url, coverPaperHex),
      elements: remapElements(side.elements ?? [], coverPaperHex),
    }
  }
  const outsideCover = remapCover(passport.cover_outside_data ?? null)
  const insideCover = remapCover(passport.cover_inside_data ?? null)
  const remappedPages: PassportPageForPrint[] = pagesForPrint.map((p) => {
    const pageHex = (p.paper_color ?? 'F5F2EC').replace(/^#/, '')
    return {
      ...p,
      background_image_url: remap(p.background_image_url, pageHex),
      elements: remapElements(p.elements ?? [], pageHex),
      // Swap each raster/emoji stamp's raw URL for its normalized
      // data:image URI (null if the fetch/decode failed → blank box).
      stops: p.stops.map((stop) =>
        stop.stampImageUrl && !stop.stampImageUrl.startsWith('data:')
          ? { ...stop, stampImageUrl: remap(stop.stampImageUrl, pageHex, true) }
          : stop,
      ),
    }
  })

  // Marketing image — free passports get a split top strip on the
  // cover sheet (left half marketing, right half instructions). The
  // strip is the discardable cut-off after assembly so the marketing
  // is high-visibility-then-gone. Paid passports get the original
  // full-width instructions. Image is the okuji-ground-03 woven-waves
  // design (banknote-style with the okuji wordmark centered).
  const marketingImageDataUri = (passport.price_cents ?? 0) === 0
    ? await loadMarketingMark()
    : null

  // Render PDF
  let pdfBuffer: Buffer
  try {
    pdfBuffer = await renderToBuffer(
      <PrintPassportDoc
        passportTitle={passport.title}
        institutionName={institutionName}
        passportType={passportType}
        includeCert={includeCert}
        outsideCover={outsideCover}
        insideCover={insideCover}
        paperColorHex={paperColorHex}
        stampPages={remappedPages}
        marketingImageDataUri={marketingImageDataUri}
      />
    )
  } catch (err) {
    console.error('[print-pdf] renderToBuffer error:', err)
    return new Response(JSON.stringify({ error: 'PDF generation failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  // Log print job (best-effort)
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('print_jobs').insert({
      passport_id: passportId,
      institution_id: passport.proprietor_id ?? null,
      created_by: user.id,
      // Sensible defaults — stop_ids/copies/journal_setting columns remain
      // on the print_jobs table but are no longer driven by the UI.
      stop_ids: [],
      copies: 1,
      journal_setting: 'per_stop',
    })
  } catch (err) {
    console.warn('[print-pdf] failed to log print job:', err)
  }

  // Return PDF
  const dateStr = new Date().toISOString().slice(0, 10)
  const safeTitle = passport.title.replace(/[^\w\s-]/g, '').trim()
  const filename = `${safeTitle} - Print Passport - ${dateStr}.pdf`
  return new Response(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
