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
  /** Luminance cutoff in 0..255. Pixels darker than this become
   *  ink. The composer surfaces this via the threshold slider. */
  threshold: number
  /** RDP epsilon — pixel-units of error tolerance. Higher =
   *  fewer points, blockier paths. 1.0 is a sensible default. */
  simplifyTolerance?: number
  /** Skip tiny noise blobs (under N ink pixels). Helps with
   *  speckle from low-quality JPEGs. */
  minBlobPixels?: number
}

/** Load an HTMLImageElement from a File. */
export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(new Error(`Image load failed: ${e}`)) }
    img.src = url
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

/** Pixel → binary ink. Luminance via ITU-R BT.601. Transparent
 *  pixels read as paper (alpha-weighted). */
function binarize(
  data: Uint8ClampedArray, w: number, h: number, threshold: number,
): Uint8Array {
  const bin = new Uint8Array(w * h)
  for (let i = 0, p = 0; i < bin.length; i++, p += 4) {
    const a = data[p + 3] / 255
    const lum = (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) * a + (1 - a) * 255
    bin[i] = lum < threshold ? 1 : 0
  }
  return bin
}

/** Standard 4-connected component labelling — produces a label
 *  for every ink pixel + a per-label pixel count for noise drop. */
function labelComponents(bin: Uint8Array, w: number, h: number): {
  labels: Int32Array
  counts: number[]
} {
  const labels = new Int32Array(bin.length).fill(-1)
  const counts: number[] = []
  const stack: number[] = []
  let next = 0

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x
      if (bin[idx] !== 1 || labels[idx] !== -1) continue
      // Flood fill from (x, y).
      stack.push(idx)
      labels[idx] = next
      let n = 0
      while (stack.length > 0) {
        const c = stack.pop()!
        n++
        const cx = c % w, cy = (c / w) | 0
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const nx = cx + dx, ny = cy + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const ni = ny * w + nx
          if (bin[ni] === 1 && labels[ni] === -1) {
            labels[ni] = next
            stack.push(ni)
          }
        }
      }
      counts.push(n)
      next++
    }
  }
  return { labels, counts }
}

/** Moore-neighbor boundary trace for one connected blob.
 *  Returns the outer-boundary contour as a list of (x, y)
 *  points (inclusive on the ink cell coordinates).
 *
 *  Holes inside the blob aren't traced separately here; the
 *  combined output relies on fill-rule even-odd for clean
 *  rendering when the original art has interior cutouts. A
 *  future enhancement (true potrace) would trace holes
 *  explicitly. */
function traceBoundary(
  labels: Int32Array, w: number, h: number, label: number,
): { x: number; y: number }[] {
  // Locate the topmost-leftmost pixel of this label.
  let startX = -1, startY = -1
  for (let y = 0; y < h && startX < 0; y++) {
    for (let x = 0; x < w; x++) {
      if (labels[y * w + x] === label) { startX = x; startY = y; break }
    }
  }
  if (startX < 0) return []

  const isInk = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < w && y < h && labels[y * w + x] === label

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
      if (isInk(nx, ny)) {
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
 * O(w*h) for binarization + flood fill. The composer caps maxDim
 * so the work stays interactive while the threshold slider drags.
 */
export function traceImageData(
  img: HTMLImageElement,
  opts: TraceOptions,
): TraceResult {
  const { threshold, simplifyTolerance = 1.0, minBlobPixels = 8 } = opts
  const MAX_DIM = 320  // tracer cap; the composer downscales here
  const { data, w, h } = rasterize(img, MAX_DIM)
  const bin = binarize(data, w, h, threshold)
  const { labels, counts } = labelComponents(bin, w, h)
  const contours: { x: number; y: number }[][] = []
  for (let label = 0; label < counts.length; label++) {
    if (counts[label] < minBlobPixels) continue
    const c = traceBoundary(labels, w, h, label)
    if (c.length === 0) continue
    contours.push(rdp(c, simplifyTolerance))
  }
  return { d: contoursToPathD(contours), w, h }
}
