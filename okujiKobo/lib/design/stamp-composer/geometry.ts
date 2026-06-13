/**
 * Pure geometry helpers shared by the canvas (live editing) and
 * the SVG serializer (save). Keeping these out of either file
 * so renderer + serializer can't drift on the math.
 */

/**
 * Build an SVG path "d" string for an elliptical arc used as a
 * textPath baseline.
 *
 * Both arcs run LEFT → RIGHT so glyphs sit upright (textPath
 * places baselines along the path's direction; left-to-right
 * direction = upright reading order):
 *
 *   - TOP arc — sweep flag 1 (CW from left endpoint over the
 *     top). Path arcs UP through (cx, cy-ry). Text baseline
 *     bows UPWARD; glyphs stay upright.
 *
 *   - BOTTOM arc — sweep flag 0 (CCW from left endpoint via
 *     the bottom). Path arcs DOWN through (cx, cy+ry). Text
 *     baseline bows DOWNWARD; glyphs stay upright (a "smile"
 *     curve, not classical stamp-rim flipped text).
 *
 * Note: classical circular-seal rim text inverts at the bottom
 * (glyph feet face center). That's a DIFFERENT effect and would
 * need a third arc mode if requested.
 */
export function arcPathD(
  cx: number, cy: number,
  rx: number, ry: number,
  arc: 'top' | 'bottom',
): string {
  const x0 = cx - rx, y0 = cy
  const x1 = cx + rx, y1 = cy
  // Top: sweep=1 (CW) goes up over the top. Bottom: sweep=0
  // (CCW) goes down through the bottom. Same endpoints; only
  // the sweep flag differs.
  const sweep = arc === 'top' ? 1 : 0
  return `M ${num(x0)} ${num(y0)} A ${num(rx)} ${num(ry)} 0 0 ${sweep} ${num(x1)} ${num(y1)}`
}

/** Two-decimal rounding to keep emitted SVG small. */
export function num(v: number): string {
  return (Math.round(v * 100) / 100).toString()
}

/**
 * Outline geometry for a polyshape, given its bounding box. Returns either
 * polygon points (star / diamond / pentagon) or a path `d` (shield). Shared
 * by the canvas preview and the serializer so they can't drift.
 */
export function polyshapeGeometry(
  shape: import('./types').PolyshapeKind,
  x: number, y: number, w: number, h: number,
): { points: string } | { path: string } {
  const cx = x + w / 2, cy = y + h / 2, rx = w / 2, ry = h / 2
  const poly = (pts: Array<[number, number]>) => ({
    points: pts.map(([px, py]) => `${num(px)},${num(py)}`).join(' '),
  })
  switch (shape) {
    case 'diamond':
      return poly([[cx, y], [x + w, cy], [cx, y + h], [x, cy]])
    case 'pentagon': {
      const pts: Array<[number, number]> = []
      for (let i = 0; i < 5; i++) {
        const a = ((-90 + i * 72) * Math.PI) / 180
        pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)])
      }
      return poly(pts)
    }
    case 'star': {
      const pts: Array<[number, number]> = []
      const inner = 0.382 // classic 5-point star inner/outer ratio
      for (let i = 0; i < 10; i++) {
        const a = ((-90 + i * 36) * Math.PI) / 180
        const r = i % 2 === 0 ? 1 : inner
        pts.push([cx + rx * r * Math.cos(a), cy + ry * r * Math.sin(a)])
      }
      return poly(pts)
    }
    case 'shield':
      // Flat top, sides drop to 55% then curve in to a bottom point.
      return {
        path:
          `M ${num(x)} ${num(y)} ` +
          `L ${num(x + w)} ${num(y)} ` +
          `L ${num(x + w)} ${num(y + h * 0.55)} ` +
          `Q ${num(x + w)} ${num(y + h * 0.85)} ${num(cx)} ${num(y + h)} ` +
          `Q ${num(x)} ${num(y + h * 0.85)} ${num(x)} ${num(y + h * 0.55)} Z`,
      }
  }
}

/** Map a text-justification value to the SVG `text-anchor` keyword. */
export function textAnchorFor(align: 'left' | 'center' | 'right' | undefined): 'start' | 'middle' | 'end' {
  return align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start'
}

/** Apply optional uppercase + letter-spacing transformation to
 *  raw text. uppercase mutates the string; letter-spacing is
 *  applied via the SVG attribute, NOT the text content. */
export function renderText(text: string, opts: { uppercase?: boolean }): string {
  return opts.uppercase ? text.toUpperCase() : text
}
