/**
 * Rich-text runs helpers.
 *
 * Bridges between three representations of a multi-line formatted text
 * block:
 *
 *   1. Storage shape — TextRun[] (lib/design/types.ts). Persisted in the
 *      page_elements jsonb column. The source of truth.
 *
 *   2. ContentEditable DOM — the in-browser editor (RightInspector
 *      RichTextEditor) uses a contentEditable div. Editor lifecycle:
 *      mount → runsToHtml(initialRuns) into innerHTML; designer edits;
 *      blur → domToRuns(div) back into TextRun[]; persist.
 *
 *   3. React renderer — JSX trees for both the designer canvas
 *      (PageElementBox) and the holder render (ReadOnlyElements). Walks
 *      runs directly into <strong>/<em>/<u>/<br> elements; never uses
 *      dangerouslySetInnerHTML, so XSS is structurally impossible.
 *
 * The DOM parsing path is deliberately tolerant: contentEditable +
 * execCommand emit either <b>/<i> or <strong>/<em> or inline-style spans
 * depending on browser + browser version. We accept all three.
 */

import type { TextRun } from './types'

// ── Storage → React JSX ─────────────────────────────────────────────────

/** Renders a runs array into a flat JSX fragment.
 *  Newlines (text === '\n' OR embedded \n in a longer run) become <br>. */
export function runsToReact(runs: TextRun[]): React.ReactNode {
  // Lazy-import React to avoid pulling it in callers that only use the
  // parse helpers (e.g. SVG export). The caller already has React in
  // scope when they invoke this; we just need React.Fragment + createElement.
  const React = require('react') as typeof import('react')
  return React.createElement(
    React.Fragment,
    null,
    ...runs.flatMap((run, runIdx) => {
      // Split on \n so we can interleave <br>.
      const segments = run.text.split('\n')
      const nodes: React.ReactNode[] = []
      segments.forEach((seg, segIdx) => {
        if (seg.length > 0) {
          let node: React.ReactNode = seg
          if (run.underline) node = React.createElement('u', { key: `u-${runIdx}-${segIdx}` }, node)
          if (run.italic)    node = React.createElement('em', { key: `em-${runIdx}-${segIdx}` }, node)
          if (run.bold)      node = React.createElement('strong', { key: `b-${runIdx}-${segIdx}` }, node)
          nodes.push(React.createElement(React.Fragment, { key: `s-${runIdx}-${segIdx}` }, node))
        }
        if (segIdx < segments.length - 1) {
          nodes.push(React.createElement('br', { key: `br-${runIdx}-${segIdx}` }))
        }
      })
      return nodes
    }),
  )
}

// ── Storage → HTML string (for contentEditable seed) ────────────────────

export function runsToHtml(runs: TextRun[]): string {
  return runs
    .map((run) => {
      const escaped = escapeHtml(run.text).replace(/\n/g, '<br>')
      let html = escaped
      if (run.underline) html = `<u>${html}</u>`
      if (run.italic)    html = `<em>${html}</em>`
      if (run.bold)      html = `<strong>${html}</strong>`
      return html
    })
    .join('')
}

// ── Storage → plain text (for SVG export + accessibility) ───────────────

export function runsToPlainText(runs: TextRun[]): string {
  return runs.map((r) => r.text).join('')
}

// ── ContentEditable DOM → storage ───────────────────────────────────────
//
// Walks the editor's DOM. Detects bold / italic / underline from BOTH
// semantic tags (B, STRONG, I, EM, U) AND inline styles, because
// document.execCommand picks one or the other depending on browser.
// Block-level wrappers (DIV, P) emit a newline after their content
// unless the previous run already ended in a newline.

export function domToRuns(root: HTMLElement): TextRun[] {
  const out: TextRun[] = []
  walk(root, false, false, false, out)
  return mergeAdjacent(trimTrailingNewline(out))
}

function walk(node: Node, b: boolean, i: boolean, u: boolean, out: TextRun[]): void {
  if (node.nodeType === 3) {
    const text = node.textContent ?? ''
    if (text) push(out, text, b, i, u)
    return
  }
  if (node.nodeType !== 1) return
  const el = node as HTMLElement
  const tag = el.tagName

  if (tag === 'BR') {
    push(out, '\n', b, i, u)
    return
  }

  // Child formatting = parent OR self-introduced.
  const style = el.style
  const childB = b || tag === 'B' || tag === 'STRONG'
    || isBoldFontWeight(style.fontWeight)
  const childI = i || tag === 'I' || tag === 'EM'
    || style.fontStyle === 'italic'
  const childU = u || tag === 'U'
    || (style.textDecoration ?? '').includes('underline')

  el.childNodes.forEach((c) => walk(c, childB, childI, childU, out))

  // Block-level boundary → newline (DIV/P/H1-6/LI). Skip if the last
  // emitted character is already \n so we don't double-break.
  if (BLOCK_TAGS.has(tag)) {
    const last = out[out.length - 1]
    if (!last || !last.text.endsWith('\n')) push(out, '\n', b, i, u)
  }
}

const BLOCK_TAGS = new Set(['DIV', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI'])

function isBoldFontWeight(w: string): boolean {
  if (!w) return false
  if (w === 'bold' || w === 'bolder') return true
  const n = Number(w)
  return Number.isFinite(n) && n >= 600
}

function push(out: TextRun[], text: string, b: boolean, i: boolean, u: boolean): void {
  const run: TextRun = { text }
  if (b) run.bold = true
  if (i) run.italic = true
  if (u) run.underline = true
  out.push(run)
}

function mergeAdjacent(runs: TextRun[]): TextRun[] {
  const merged: TextRun[] = []
  for (const r of runs) {
    const last = merged[merged.length - 1]
    if (
      last
      && !!last.bold      === !!r.bold
      && !!last.italic    === !!r.italic
      && !!last.underline === !!r.underline
    ) {
      last.text += r.text
    } else {
      merged.push({ ...r })
    }
  }
  return merged
}

function trimTrailingNewline(runs: TextRun[]): TextRun[] {
  if (runs.length === 0) return runs
  const last = runs[runs.length - 1]
  const trimmed = last.text.replace(/\n+$/, '')
  if (trimmed === last.text) return runs
  if (trimmed === '') return runs.slice(0, -1)
  return [...runs.slice(0, -1), { ...last, text: trimmed }]
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── Address pre-fill ────────────────────────────────────────────────────
//
// Composes a stop's address fields into runs suitable for seeding a new
// richtext block. Returns an empty array (so the editor opens blank)
// when the stop has no usable address fields — the designer can still
// type freely from there.
//
// Layout:
//   {street}                    (line 1)
//   {city}, {state} {zip}       (line 2 — comma + space, US convention)
//   {country}                   (line 3 — only when country !== 'US')
//
// All runs are emitted unstyled so the designer can add formatting on top
// without the seed fighting them.

export interface StopAddressFields {
  address_street?: string | null
  address_city?: string | null
  address_state?: string | null
  address_zip?: string | null
  country?: string | null
}

export function stopAddressToRuns(stop: StopAddressFields | null | undefined): TextRun[] {
  if (!stop) return []
  const street  = (stop.address_street ?? '').trim()
  const city    = (stop.address_city   ?? '').trim()
  const state   = (stop.address_state  ?? '').trim()
  const zip     = (stop.address_zip    ?? '').trim()
  const country = (stop.country        ?? '').trim()
  const lines: string[] = []
  if (street) lines.push(street)
  const cityLine = [city, state].filter(Boolean).join(', ') + (zip ? ` ${zip}` : '')
  if (cityLine.trim()) lines.push(cityLine.trim())
  if (country && country.toUpperCase() !== 'US' && country.toUpperCase() !== 'USA') {
    lines.push(country)
  }
  if (lines.length === 0) return []
  return [{ text: lines.join('\n') }]
}
