/**
 * Pure geometry helpers shared by the canvas (live editing) and
 * the SVG serializer (save). Keeping these out of either file
 * so renderer + serializer can't drift on the math.
 */

/**
 * Build an SVG path "d" string for an elliptical arc used as a
 * textPath baseline.
 *
 * SVG textPath places glyphs along the path's direction with
 * baseline perpendicular to the tangent. For rim text to read
 * right-side-up:
 *
 *   - TOP arc: path goes LEFT → RIGHT along the top of the
 *     ellipse (sweep flag 1, CW from left endpoint over
 *     the top). Tangent at start points up; text appears to
 *     climb to the peak then descend.
 *
 *   - BOTTOM arc: path goes RIGHT → LEFT along the bottom
 *     (sweep flag 1, CW from right endpoint via the bottom).
 *     Reading direction matches the path direction; text
 *     appears upright at the bottom of the ellipse.
 *
 * Both arcs use the SAME large-arc flag (0 = semicircle ≤180°)
 * and the SAME sweep flag (1). Only the start/end endpoints
 * differ.
 */
export function arcPathD(
  cx: number, cy: number,
  rx: number, ry: number,
  arc: 'top' | 'bottom',
): string {
  if (arc === 'top') {
    const x0 = cx - rx, y0 = cy
    const x1 = cx + rx, y1 = cy
    return `M ${num(x0)} ${num(y0)} A ${num(rx)} ${num(ry)} 0 0 1 ${num(x1)} ${num(y1)}`
  }
  const x0 = cx + rx, y0 = cy
  const x1 = cx - rx, y1 = cy
  return `M ${num(x0)} ${num(y0)} A ${num(rx)} ${num(ry)} 0 0 1 ${num(x1)} ${num(y1)}`
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
