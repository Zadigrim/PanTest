/**
 * Stamp Composer — image → vector trace.
 *
 * Tier-1 monochrome tracer for the "Trace an image" element.
 * Vendored (no new dependency) so the composer doesn't take on
 * a tracer lib for the curated logo/seal use case the spec
 * describes. Works best on the inputs the brief calls out —
 * logos, seals, high-contrast clip-art on plain backgrounds —
 * and degrades to a faithful-but-chunky outline on noisier
 * images. AI photo-to-icon conversion stays out of scope.
 *
 * Algorithm: threshold → connected-component labelling → Moore-
 * neighbor boundary tracing → Ramer–Douglas–Peucker simplify →
 * single composite SVG `path d="…"` string with fill-rule
 * even-odd so inner holes punch through correctly.
 *
 * TODO: future flagged enhancement — AI iconization (a richer
 * tracer or model-based stylizer). The signature here returns
 * an SVG `d` string; any future swap can keep this same
 * contract.
 */

export interface TraceResult {
  /** SVG path data with all blobs joined; fill-rule even-odd. */
  d: string
  /** Source pixel dimensions; used for placing the TracedElement
   *  in the composer surface. */
  w: number
  /** Source pixel height. */
  h: number
}

export interface TraceOptions {
  /** Luminance cutoff in 0..255. The composer surfaces this via
   *  the threshold slider. Meaning depends on `invert`:
   *    invert=false (default) — pixels darker than this become ink.
   *    invert=true            — pixels brighter than this become ink. */
  threshold: number
  /** Trace LIGHT pixels instead of dark ones. Useful for white-
   *  on-transparent inputs (logo SVGs exported with the visible
   *  content as white) where the natural reading is "the white
   *  is the artwork". Alpha is treated differently per mode:
   *    invert=false → transparent reads as bright (paper); the
   *      typical dark-on-white-or-transparent input gets a clean
   *      trace of just the dark pixels.
   *    invert=true  → transparent reads as DARK (paper); only
   *      visible bright pixels become ink. White-on-transparent
   *      then traces the white shape; the transparent area stays
   *      paper as expected. */
  invert?: boolean
  /** RDP epsilon — pixel-units of error tolerance. Higher =
   *  fewer points, blockier paths. 1.0 is a sensible default. */
  simplifyTolerance?: number
  /** Skip tiny noise blobs (under N ink pixels). Helps with
   *  speckle from low-quality JPEGs. */
  minBlobPixels?: number
}

/** Load an HTMLImageElement from a File.
 *
 *  Reads the file as a data URL (via FileReader) and assigns it
 *  to the Image's src. Using a data URL — instead of a blob URL
 *  via URL.createObjectURL — sidesteps the lifecycle bug where
 *  the picker's Source preview shows a broken-image icon
 *  because the blob URL was revoked the moment the image
 *  finished loading. Data URLs survive for the Image's lifetime
 *  and re-render cleanly when the React component reads
 *  `img.src` for the preview <img>. */
export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload  = () => resolve(img)
      img.onerror = (e) => reject(new Error(`Image load failed: ${e}`))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

/** Draw an image to an offscreen canvas + return ImageData. */
function rasterize(img: HTMLImageElement, maxDim: number): {
  data: Uint8ClampedArray
  w: number
  h: number
} {
  // Downscale very large inputs — tracer time is O(w*h).
  let w = img.naturalWidth
  let h = img.naturalHeight
  if (Math.max(w, h) > maxDim) {
    const scale = maxDim / Math.max(w, h)
    w = Math.round(w * scale)
    h = Math.round(h * scale)
  }
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('2D context unavailable')
  ctx.drawImage(img, 0, 0, w, h)
  return { data: ctx.getImageData(0, 0, w, h).data, w, h }
}

/** Pixel → binary ink. Luminance via ITU-R BT.601. Alpha handling
 *  flips with `invert`:
 *    invert=false → transparent reads as bright (paper). The
 *      effective luminance is α·rgb + (1−α)·255, so a fully-
 *      transparent pixel evaluates to 255 (paper).
 *    invert=true  → transparent reads as dark (also paper, since
 *      in invert mode bright = ink). Effective luminance is
 *      α·rgb, so transparent → 0; only visible bright pixels
 *      pass the > threshold test. */
function binarize(
  data: Uint8ClampedArray, w: number, h: number, threshold: number, invert: boolean,
): Uint8Array {
  const bin = new Uint8Array(w * h)
  for (let i = 0, p = 0; i < bin.length; i++, p += 4) {
    const a = data[p + 3] / 255
    const rgbLum = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]
    if (invert) {
      const eff = rgbLum * a
      bin[i] = eff > threshold ? 1 : 0
    } else {
      const eff = rgbLum * a + (1 - a) * 255
      bin[i] = eff < threshold ? 1 : 0
    }
  }
  return bin
}

/** Connected component labelling for binary pixels.
 *
 *  Two passes per call: 4-connected flood-fill from each
 *  unvisited target-valued pixel. Returns per-label pixel
 *  counts (for noise drop), the topmost-leftmost pixel of each
 *  label (so traceBoundary can start from a known good cell
 *  without re-scanning), and whether each label touches the
 *  image edge (so the caller can identify the background paper
 *  component when labelling paper for hole detection).
 *
 *  `target` is the binary value to LABEL — 1 for ink blobs,
 *  0 for paper components.
 */
function labelComponents(bin: Uint8Array, w: number, h: number, target: 0 | 1): {
  labels: Int32Array
  counts: number[]
  firstPixel: { x: number; y: number }[]
  touchesEdge: boolean[]
} {
  const labels = new Int32Array(bin.length).fill(-1)
  const counts: number[] = []
  const firstPixel: { x: number; y: number }[] = []
  const touchesEdge: boolean[] = []
  const stack: number[] = []
  let next = 0

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x
      if (bin[idx] !== target || labels[idx] !== -1) continue
      // Flood fill from (x, y).
      stack.push(idx)
      labels[idx] = next
      firstPixel.push({ x, y })  // topmost-leftmost by scan order
      let n = 0
      let edge = false
      while (stack.length > 0) {
        const c = stack.pop()!
        n++
        const cx = c % w, cy = (c / w) | 0
        if (cx === 0 || cy === 0 || cx === w - 1 || cy === h - 1) edge = true
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nx = cx + dx, ny = cy + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const ni = ny * w + nx
          if (bin[ni] === target && labels[ni] === -1) {
            labels[ni] = next
            stack.push(ni)
          }
        }
      }
      counts.push(n)
      touchesEdge.push(edge)
      next++
    }
  }
  return { labels, counts, firstPixel, touchesEdge }
}

/** Moore-neighbor boundary trace for one connected region.
 *  Returns the outer-boundary contour as a list of (x, y)
 *  points (inclusive on the cell coordinates of the region).
 *
 *  Generic over what "membership" means: caller passes an
 *  `isMember(x, y)` predicate so the same routine traces both
 *  ink blobs (for outer letter shapes) and paper holes (for
 *  the counterforms inside letters). Pre-located starting cell
 *  via startX/startY avoids re-scanning. */
function traceBoundary(
  w: number, h: number,
  startX: number, startY: number,
  isMember: (x: number, y: number) => boolean,
): { x: number; y: number }[] {
  // 8-neighborhood offsets ordered clockwise from "above".
  const dirs = [
    [0, -1], [1, -1], [1, 0], [1, 1],
    [0,  1], [-1, 1], [-1, 0], [-1, -1],
  ] as const

  const contour: { x: number; y: number }[] = [{ x: startX, y: startY }]
  let cx = startX, cy = startY
  // Coming from the LEFT means we last moved right; start the
  // Moore scan from the LEFT neighbor (index 6) so the first
  // check rotates clockwise around the starting pixel.
  let prevDir = 6
  const max = w * h * 4  // safety cap; should never be hit
  for (let step = 0; step < max; step++) {
    let found = false
    for (let i = 0; i < 8; i++) {
      // Start search just past the direction we came from.
      const d = (prevDir + 1 + i) & 7
      const [dx, dy] = dirs[d]
      const nx = cx + dx, ny = cy + dy
      if (nx >= 0 && ny >= 0 && nx < w && ny < h && isMember(nx, ny)) {
        cx = nx; cy = ny
        // The direction we came from is the OPPOSITE of d.
        prevDir = (d + 4) & 7
        contour.push({ x: cx, y: cy })
        found = true
        break
      }
    }
    if (!found) break  // isolated pixel
    if (cx === startX && cy === startY && contour.length > 2) {
      contour.pop()  // remove duplicated start
      break
    }
  }
  return contour
}

/** Ramer–Douglas–Peucker — recursive polyline simplification. */
function rdp(
  pts: { x: number; y: number }[], epsilon: number,
): { x: number; y: number }[] {
  if (pts.length < 3) return pts
  let maxDist = 0
  let index = 0
  const last = pts.length - 1
  for (let i = 1; i < last; i++) {
    const d = perpendicularDistance(pts[i], pts[0], pts[last])
    if (d > maxDist) { maxDist = d; index = i }
  }
  if (maxDist > epsilon) {
    const left  = rdp(pts.slice(0, index + 1), epsilon)
    const right = rdp(pts.slice(index), epsilon)
    return left.slice(0, -1).concat(right)
  }
  return [pts[0], pts[last]]
}

function perpendicularDistance(
  p:  { x: number; y: number },
  a:  { x: number; y: number },
  b:  { x: number; y: number },
): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  if (dx === 0 && dy === 0) {
    const ex = p.x - a.x, ey = p.y - a.y
    return Math.sqrt(ex * ex + ey * ey)
  }
  const num = Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x)
  const den = Math.sqrt(dx * dx + dy * dy)
  return num / den
}

/** Compose contours into a single SVG path `d=` string with
 *  fill-rule even-odd. */
function contoursToPathD(contours: { x: number; y: number }[][]): string {
  return contours.map((c) => {
    if (c.length === 0) return ''
    const head = `M ${fmt(c[0].x)} ${fmt(c[0].y)}`
    const tail = c.slice(1).map((p) => `L ${fmt(p.x)} ${fmt(p.y)}`).join(' ')
    return `${head} ${tail} Z`
  }).filter(Boolean).join(' ')
}

function fmt(v: number): string {
  return (Math.round(v * 100) / 100).toString()
}

/**
 * Public entry. Threshold + label + trace + simplify + serialize.
 * Synchronous after the image is loaded; main-thread cost is
 * O(w*h) for binarization + two flood fills (ink + paper). The
 * composer caps maxDim so the work stays interactive while the
 * threshold slider drags.
 *
 * Holes (interior counterforms — the inside of an `o`, the
 * bowl of a `u`, etc.) are traced as separate inner contours
 * and emitted alongside the outer boundaries. The output uses
 * fill-rule="evenodd", so the inner contours punch through the
 * outer fill: counterforms render as actual holes, not solid.
 * Without this pass, an `o` reads as a filled dot.
 */
export function traceImageData(
  img: HTMLImageElement,
  opts: TraceOptions,
): TraceResult {
  const { threshold, invert = false, simplifyTolerance = 1.0, minBlobPixels = 8 } = opts
  const MAX_DIM = 320  // tracer cap; the composer downscales here
  const { data, w, h } = rasterize(img, MAX_DIM)
  const bin = binarize(data, w, h, threshold, invert)
  // Label ink (target=1) AND paper (target=0). Paper labelling
  // is what lets us detect holes inside ink blobs — anything
  // that's a paper-component but doesn't touch the image edge
  // is, by definition, an interior hole.
  const ink   = labelComponents(bin, w, h, 1)
  const paper = labelComponents(bin, w, h, 0)
  const contours: { x: number; y: number }[][] = []

  // Outer boundaries of ink blobs.
  for (let label = 0; label < ink.counts.length; label++) {
    if (ink.counts[label] < minBlobPixels) continue
    const start = ink.firstPixel[label]
    const c = traceBoundary(w, h, start.x, start.y,
      (x, y) => ink.labels[y * w + x] === label)
    if (c.length === 0) continue
    contours.push(rdp(c, simplifyTolerance))
  }

  // Inner boundaries — every paper component that DOES NOT
  // touch the image edge. The edge-touching paper component is
  // the background; the rest are holes carved into ink. A
  // 4-pixel floor catches noise without missing fine
  // counterforms (the dot inside a small `o` is still a real
  // visual feature).
  const HOLE_MIN = 4
  for (let label = 0; label < paper.counts.length; label++) {
    if (paper.touchesEdge[label]) continue
    if (paper.counts[label] < HOLE_MIN) continue
    const start = paper.firstPixel[label]
    const c = traceBoundary(w, h, start.x, start.y,
      (x, y) => paper.labels[y * w + x] === label)
    if (c.length === 0) continue
    contours.push(rdp(c, simplifyTolerance))
  }

  return { d: contoursToPathD(contours), w, h }
}
