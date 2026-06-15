// Canonical PHYSICAL print spec for an okuji passport — the single source
// of truth for "how big is a real passport." The on-screen / design
// artboard works in resolution-independent design units (page 612×869,
// cover wrap 1252×869); THIS module pins those units to real-world
// millimetres and PDF points so the print pipeline can target the true
// trim size + bleed.
//
// Spec: US / ISO passport book, ISO/IEC 7810 ID-3.
//   - Page (one leaf):  88 mm × 125 mm  (portrait)
//   - Cover wrap:       180 mm × 125 mm (back 88 + spine 4 + front 88)
//   - Bleed:            3 mm per edge (a typical default; a real print
//                       partner — e.g. Shutterfly — will specify its own.
//                       Override BLEED_MM when wiring a partner template.)
//
// PDF points: 1 pt = 1/72 in, 1 in = 25.4 mm  →  1 mm = 72/25.4 pt.

export const MM_PER_IN = 25.4
export const PT_PER_IN = 72
export const PT_PER_MM = PT_PER_IN / MM_PER_IN // ≈ 2.8346

export const mmToPt = (mm: number): number => mm * PT_PER_MM

// ── Trim (finished) sizes in millimetres ──
export const PAGE_TRIM_W_MM = 88
export const PAGE_TRIM_H_MM = 125
export const SPINE_MM = 4
export const COVER_TRIM_W_MM = PAGE_TRIM_W_MM * 2 + SPINE_MM // 180
export const COVER_TRIM_H_MM = PAGE_TRIM_H_MM // 125

// ── Bleed ──
export const BLEED_MM = 3

// ── Derived PDF-point sizes ──
// Trim = finished size; Full = trim + bleed on every edge (the artboard a
// print partner consumes; crop marks sit at the trim box inside it).
export const PAGE_TRIM_W_PT = mmToPt(PAGE_TRIM_W_MM) // ≈ 249.4
export const PAGE_TRIM_H_PT = mmToPt(PAGE_TRIM_H_MM) // ≈ 354.3
export const BLEED_PT = mmToPt(BLEED_MM) // ≈ 8.5
export const PAGE_FULL_W_PT = PAGE_TRIM_W_PT + 2 * BLEED_PT
export const PAGE_FULL_H_PT = PAGE_TRIM_H_PT + 2 * BLEED_PT
export const COVER_TRIM_W_PT = mmToPt(COVER_TRIM_W_MM)
export const COVER_TRIM_H_PT = mmToPt(COVER_TRIM_H_MM)
export const COVER_FULL_W_PT = COVER_TRIM_W_PT + 2 * BLEED_PT
export const COVER_FULL_H_PT = COVER_TRIM_H_PT + 2 * BLEED_PT

// ── Design units (the artboard coordinate space these mm map to) ──
// Page width is anchored at 612 design units = 88 mm; everything else
// derives so the ratio matches the spec exactly. These mirror the
// constants in lib/explore/svg/PageSvg.tsx (PAGE_W/PAGE_H) and
// components/design/CoverCanvas.tsx (SPINE_W/CANVAS_W) — kobo is the
// graphical source of truth; keep them in lockstep.
export const PAGE_DESIGN_W = 612
export const PAGE_DESIGN_H = 869 // round(612 × 125/88)
export const COVER_SPINE_DESIGN_W = 28 // round(612 × 4/88) ≈ 4 mm
export const COVER_DESIGN_W = PAGE_DESIGN_W * 2 + COVER_SPINE_DESIGN_W // 1252
export const COVER_DESIGN_H = PAGE_DESIGN_H // 869

// Design-unit → PDF-point scale for rendering a page/cover at true trim
// size (multiply any design-unit coordinate by this to get trim points).
export const PAGE_UNIT_TO_PT = PAGE_TRIM_W_PT / PAGE_DESIGN_W // ≈ 0.4075
export const COVER_UNIT_TO_PT = COVER_TRIM_W_PT / COVER_DESIGN_W // ≈ 0.4075
