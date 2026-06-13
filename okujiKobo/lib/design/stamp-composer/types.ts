/**
 * Stamp Composer — type model.
 *
 * The composer's source of truth is an ordered ComposerElement[]
 * that's both rendered to inline <svg> in the modal AND
 * serialized to a static SVG file at save (see svg.ts). The
 * element list also persists to design_assets.metadata so a
 * later "Edit in composer" reload recovers the live editing
 * state with no flattening loss.
 *
 * Coordinate system: all positions/sizes are in the composer's
 * internal 256×256 viewBox units. The renderer (web canvas,
 * mobile RN-SVG, react-pdf <Svg>) decides the on-screen pixel
 * size; the SVG scales because it has a viewBox.
 *
 * Color: every element uses `currentColor` for stroke/fill.
 * The web designer canvas wraps the rendered SVG in
 * <span style={{ color: stamp_color }}>, so the per-stop Ink
 * color re-inks it. Mobile + PDF replace `currentColor` with
 * the hex before embedding.
 */

export const STAMP_SURFACE_SIZE = 256

export type StampCap = 'butt' | 'round' | 'square'
export type StampJoin = 'miter' | 'round' | 'bevel'

/** Common geometry on every element. */
export interface ElementBase {
  /** Unique id (uuid-ish; the composer makes its own). */
  id: string
  /** Display label in the element-list rail. Falls back to type. */
  name?: string
  /** Rotation in degrees, anchored at the element's own center. */
  rotation?: number
}

/** Common stroke styling — applies to every visible element. */
export interface StrokeStyle {
  strokeWidth: number
  /** True → dashed stroke. Dash pattern picked at serialize time
   *  proportional to strokeWidth so it looks the same at any size. */
  dashed?: boolean
  /** Filled solid (uses currentColor); strokeOnly when false. */
  filled?: boolean
}

// ── Rectangle / rounded rectangle / square ───────────────────────────────────

export interface RectElement extends ElementBase, StrokeStyle {
  type: 'rect'
  x: number; y: number; w: number; h: number
  /** Corner radius (in viewBox units). 0 = sharp corners. */
  rx?: number
}

// ── Triangle ────────────────────────────────────────────────────────────────
//
// Three-point polygon. Default add-button creates an equilateral
// pointing up. Resize handle scales the bounding box uniformly
// around the centroid; the inspector exposes the raw three
// points for full control.

export interface TriangleElement extends ElementBase, StrokeStyle {
  type: 'triangle'
  x1: number; y1: number
  x2: number; y2: number
  x3: number; y3: number
}

// ── Circle / ellipse ─────────────────────────────────────────────────────────

export interface EllipseElement extends ElementBase, StrokeStyle {
  type: 'ellipse'
  /** Center (cx, cy). */
  cx: number; cy: number
  /** Radii. rx === ry → perfect circle. */
  rx: number; ry: number
}

// ── Line ─────────────────────────────────────────────────────────────────────

export interface LineElement extends ElementBase, StrokeStyle {
  type: 'line'
  x1: number; y1: number; x2: number; y2: number
  /** Line caps. Default 'butt' for hairline rules; 'round' for hand-drawn feel. */
  linecap?: StampCap
}

// ── Future elements (Push 2+) — kept in the union so the
//    metadata format can carry them when we land each. The
//    canvas / inspector / serializer gain branches per type.

export interface TextElement extends ElementBase {
  type: 'text'
  text: string
  x: number; y: number
  fontSize: number
  fontFamily: string
  bold?: boolean
  italic?: boolean
  uppercase?: boolean
  letterSpacing?: number
  /** Justification relative to the element's x anchor. Default 'left'.
   *  For multi-line text this aligns the lines to each other. */
  textAlign?: 'left' | 'center' | 'right'
}

// ── Polygonal shapes (star / diamond / shield / pentagon) ────────────────────
// One parameterized type rather than four, modeled like RectElement (a
// top-left + size bounding box) so it reuses rect's move/resize/bbox paths.
// The actual outline is derived from `shape` by polyshapeGeometry().

export type PolyshapeKind = 'star' | 'diamond' | 'shield' | 'pentagon'

export interface PolyshapeElement extends ElementBase, StrokeStyle {
  type: 'polyshape'
  shape: PolyshapeKind
  x: number; y: number; w: number; h: number
}

export interface CurvedTextElement extends ElementBase {
  type: 'curvedText'
  text: string
  /** Center of the arc's ellipse. */
  cx: number; cy: number
  rx: number; ry: number
  /** Arc segment: 'top' or 'bottom'. Direction is implied. */
  arc: 'top' | 'bottom'
  fontSize: number
  fontFamily: string
  bold?: boolean
  italic?: boolean
  uppercase?: boolean
  letterSpacing?: number
}

export interface IconElement extends ElementBase, StrokeStyle {
  type: 'icon'
  /** Stable key into the bundled set — survives reopen. */
  iconKey: string
  /** Inner SVG markup of the icon (the contents of its <svg>).
   *  Captured at pick-time so the saved stamp is self-contained
   *  even if the icon set is later swapped. Uses currentColor
   *  for stroke + fill so it re-inks with the rest of the stamp. */
  svgContent: string
  /** viewBox the inner markup was authored against. Most icons
   *  are 24x24 (lucide); the custom okuji set may differ. */
  viewBox: string
  x: number; y: number; size: number
}

export interface TracedElement extends ElementBase {
  type: 'traced'
  /** Raw SVG path d= attribute produced by the tracer (Push 4
   *  vendors a marching-squares + RDP tracer; future swaps to
   *  potrace keep this same shape). */
  d: string
  /** Position on the stamp surface (top-left). */
  x: number; y: number
  /** Render size on the surface. Aspect ratio comes from the
   *  ratio between this and the source pixel dimensions. */
  w: number; h: number
  /** Pixel dimensions of the source image the d= was authored
   *  against. The renderer scales `d`'s pixel coordinates into
   *  (x, y, w, h) via translate + scale. */
  sourceW: number
  sourceH: number
  /** Filled (solid currentColor) vs outline. Default filled —
   *  matches the typical seal / logo intent. */
  filled?: boolean
  /** When outlined, stroke width in surface units. */
  strokeWidth?: number
}

export type ComposerElement =
  | RectElement
  | TriangleElement
  | EllipseElement
  | LineElement
  | PolyshapeElement
  | TextElement
  | CurvedTextElement
  | IconElement
  | TracedElement

// ── Whole-document metadata (the JSON written to design_assets.metadata) ────

export interface ComposerMetadata {
  /** Schema version — bumps when ComposerElement changes shape. */
  version: 1
  /** Viewbox dimensions; today always STAMP_SURFACE_SIZE × STAMP_SURFACE_SIZE. */
  surface: { w: number; h: number }
  /** Z-order: index 0 = bottom. */
  elements: ComposerElement[]
}

/** Empty document — used by the modal's "Start blank" path. */
export function emptyComposerDoc(): ComposerMetadata {
  return {
    version: 1,
    surface: { w: STAMP_SURFACE_SIZE, h: STAMP_SURFACE_SIZE },
    elements: [],
  }
}

/** New-id helper. Composer-only — not a cryptographic uuid; we
 *  just need uniqueness within a single edit session. */
export function newElementId(): string {
  return 'el_' + Math.random().toString(36).slice(2, 10)
}
