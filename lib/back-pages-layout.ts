// Back-pages row-flow layout — PURE height estimation + page packing.
//
// The journal back-pages render one ROW per stamped stop; rows stack and pack
// onto pages by height (never one sparse page per stop). React Native can't
// measure-then-paginate synchronously while the PageFlipper's page nodes are
// built, so we estimate each row's height from its content and greedily pack.
//
// Estimates are intentionally CONSERVATIVE (slight over-estimate of text
// height) so a page rarely overfills; the page itself is a ScrollView, so any
// estimate drift — or a single row taller than one page — scrolls instead of
// clipping. A row is never split across a page boundary.
//
// Pure + framework-free so the (future) print path can pack identically —
// single source for mobile + print.
import type { BackPageRecord } from '../hooks/useBackPages'

// Page padding inside a back-page — MUST match BackJournalPage's styles.
export const BACK_PAGE_PAD_X = 20
export const BACK_PAGE_PAD_TOP = 22
export const BACK_PAGE_PAD_BOTTOM = 28
// Row card chrome (padding) + gap between stacked rows — MUST match the row styles.
export const ROW_PAD = 16
export const ROW_GAP = 12

// Line-height constants mirror the row text styles.
const JOURNAL_LINE_H = 23
const REVIEW_LINE_H = 21
// Conservative px-per-character (LOW chars/line → MORE estimated lines →
// fewer rows packed → margin against clipping).
const JOURNAL_PX_PER_CHAR = 7.2
const REVIEW_PX_PER_CHAR = 6.8
const PHOTO_BLOCK = 14 + 130 // strip margin + photo height

function lineCount(len: number, widthPx: number, pxPerChar: number): number {
  const charsPerLine = Math.max(16, Math.floor(widthPx / pxPerChar))
  return Math.max(1, Math.ceil(len / charsPerLine))
}

/** Estimated rendered height (pt) of one row card at a given page content width. */
export function estimateRowHeight(r: BackPageRecord, pageContentWidth: number): number {
  const cardInner = Math.max(120, pageContentWidth - ROW_PAD * 2)
  let h = ROW_PAD * 2 // card vertical padding

  // Baseline header (always): 56px stamp vs the name(≤2 lines)/location/visited
  // text block — take a conservative tall value covering both.
  h += 86

  if (r.journalBody) {
    h += 10 + lineCount(r.journalBody.length, cardInner, JOURNAL_PX_PER_CHAR) * JOURNAL_LINE_H
  }
  if (r.mood != null) h += 30
  if (r.photos.length > 0) h += PHOTO_BLOCK
  if (r.review) {
    let rev = 14 * 2 + 22 + 26 // box padding + label + stars
    if (r.review.body) {
      rev += 6 + lineCount(r.review.body.length, cardInner - 28, REVIEW_PX_PER_CHAR) * REVIEW_LINE_H
    }
    h += 16 + rev
  }
  // Baseline-only "no journal entry" note.
  if (!r.journalBody && r.photos.length === 0 && !r.review) h += 20

  return h
}

/**
 * Greedy row-packing: rows in the given order; when the next row would exceed
 * usableHeight, start a new page (the row moves WHOLE — never split). A single
 * row taller than usableHeight gets its own page (the page ScrollView absorbs
 * the overflow). Returns pages, each an ordered list of rows.
 */
export function packBackPages(
  records: BackPageRecord[],
  usableHeight: number,
  pageContentWidth: number,
): BackPageRecord[][] {
  const pages: BackPageRecord[][] = []
  let current: BackPageRecord[] = []
  let used = 0
  for (const r of records) {
    const rowH = estimateRowHeight(r, pageContentWidth) + ROW_GAP
    if (current.length > 0 && used + rowH > usableHeight) {
      pages.push(current)
      current = []
      used = 0
    }
    current.push(r)
    used += rowH
  }
  if (current.length > 0) pages.push(current)
  return pages
}
