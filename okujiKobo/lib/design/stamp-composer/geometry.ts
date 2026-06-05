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

/** Apply optional uppercase + letter-spacing transformation to
 *  raw text. uppercase mutates the string; letter-spacing is
 *  applied via the SVG attribute, NOT the text content. */
export function renderText(text: string, opts: { uppercase?: boolean }): string {
  return opts.uppercase ? text.toUpperCase() : text
}
