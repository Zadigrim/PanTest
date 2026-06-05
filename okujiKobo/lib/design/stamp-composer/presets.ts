/**
 * Stamp Composer — starter compositions.
 *
 * Push 1 shipped the simplest preset (date-rule). Push 5 adds the
 * two the spec called out so a non-designer starts from a curated
 * good thing on the most common stamp shapes:
 *
 *   - "Double-rim"   — outer + inner circle frame, top + bottom
 *                      curved text, center icon. The classic
 *                      civic / library seal layout.
 *   - "Simple badge" — rounded square frame with a centered
 *                      TITLE + horizontal rule + subtitle.
 *                      Generic but readable shape for parks,
 *                      maker spaces, schools.
 *
 * Presets are fully-editable element sets — picking one populates
 * the composer document and then every element behaves like one
 * the user added by hand.
 *
 * Icon-bearing presets embed the icon's inner SVG content inline
 * (instead of awaiting renderLucideToInner) so build() stays
 * synchronous and the preset chooser is instant.
 */

import { STAMP_SURFACE_SIZE, newElementId, type ComposerMetadata } from './types'
import { DEFAULT_STAMP_FONT_KEY } from '../fonts'

export interface PresetEntry {
  /** Stable id used by the preset picker. */
  key: string
  /** Display name. */
  label: string
  /** Short description below the label. */
  hint: string
  /** Builder — returns a fresh document each call so picking
   *  twice doesn't share element ids. */
  build: () => ComposerMetadata
}

const S = STAMP_SURFACE_SIZE  // 256

// Star icon — lucide-react Star, inner content + viewBox. Inlined
// so the double-rim preset doesn't have to await a render. Source:
// lucide v0.462 (MIT). currentColor stroke + fill via the
// composer's standard chrome.
const STAR_ICON_INNER =
  '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />'
const STAR_ICON_VIEWBOX = '0 0 24 24'

export const PRESETS: PresetEntry[] = [
  {
    key: 'date-rule',
    label: 'Date stamp',
    hint: 'Rounded rectangle with two rule lines — fill the lines in the designer.',
    build: () => ({
      version: 1,
      surface: { w: S, h: S },
      elements: [
        {
          id: newElementId(),
          name: 'outer',
          type: 'rect',
          x: 20, y: 60, w: S - 40, h: S - 120,
          rx: 18,
          strokeWidth: 4,
          filled: false,
        },
        {
          id: newElementId(),
          name: 'inner',
          type: 'rect',
          x: 30, y: 70, w: S - 60, h: S - 140,
          rx: 12,
          strokeWidth: 1.5,
          filled: false,
        },
        {
          id: newElementId(),
          name: 'top rule',
          type: 'line',
          x1: 50, y1: S / 2 - 12, x2: S - 50, y2: S / 2 - 12,
          strokeWidth: 2,
        },
        {
          id: newElementId(),
          name: 'bottom rule',
          type: 'line',
          x1: 50, y1: S / 2 + 18, x2: S - 50, y2: S / 2 + 18,
          strokeWidth: 2,
        },
      ],
    }),
  },

  {
    key: 'double-rim',
    label: 'Double-rim seal',
    hint: 'Two concentric circles with top + bottom curved text and a center star.',
    build: () => {
      const cx = S / 2, cy = S / 2
      return {
        version: 1,
        surface: { w: S, h: S },
        elements: [
          // Outer + inner circles
          {
            id: newElementId(),
            name: 'outer ring',
            type: 'ellipse',
            cx, cy, rx: 120, ry: 120,
            strokeWidth: 4,
            filled: false,
          },
          {
            id: newElementId(),
            name: 'inner ring',
            type: 'ellipse',
            cx, cy, rx: 105, ry: 105,
            strokeWidth: 1.5,
            filled: false,
          },
          // Top + bottom rim text. The arc radius sits BETWEEN
          // the two rings so glyphs ride the ring channel.
          {
            id: newElementId(),
            name: 'top rim',
            type: 'curvedText',
            text: 'TOP TEXT HERE',
            cx, cy,
            rx: 112, ry: 112,
            arc: 'top',
            fontSize: 16,
            fontFamily: DEFAULT_STAMP_FONT_KEY,
            bold: true,
            uppercase: true,
            letterSpacing: 2,
          },
          {
            id: newElementId(),
            name: 'bottom rim',
            type: 'curvedText',
            text: 'BOTTOM TEXT HERE',
            cx, cy,
            rx: 112, ry: 112,
            arc: 'bottom',
            fontSize: 16,
            fontFamily: DEFAULT_STAMP_FONT_KEY,
            bold: true,
            uppercase: true,
            letterSpacing: 2,
          },
          // Center star — replace with any icon from the picker.
          {
            id: newElementId(),
            name: 'center icon',
            type: 'icon',
            iconKey: 'star',
            svgContent: STAR_ICON_INNER,
            viewBox: STAR_ICON_VIEWBOX,
            x: cx - 32, y: cy - 32, size: 64,
            strokeWidth: 2,
          },
        ],
      }
    },
  },

  {
    key: 'simple-badge',
    label: 'Simple badge',
    hint: 'Rounded square frame, centered TITLE, rule line, subtitle. Edit the words.',
    build: () => {
      const cx = S / 2, cy = S / 2
      // Width estimate for the title — the canvas centers on
      // (x, y) by adding fontSize*0.55*length/2 to x. Picking
      // characters that match the seed roughly fills the frame.
      const titleFontSize = 30
      const titleText = 'TITLE'
      const titleHalfW = titleText.length * titleFontSize * 0.55 / 2
      const subtitleFontSize = 14
      const subtitleText = 'subtitle line'
      const subtitleHalfW = subtitleText.length * subtitleFontSize * 0.55 / 2

      return {
        version: 1,
        surface: { w: S, h: S },
        elements: [
          // Outer frame
          {
            id: newElementId(),
            name: 'frame',
            type: 'rect',
            x: 28, y: 28, w: S - 56, h: S - 56,
            rx: 18,
            strokeWidth: 4,
            filled: false,
          },
          // Inner accent
          {
            id: newElementId(),
            name: 'inner accent',
            type: 'rect',
            x: 40, y: 40, w: S - 80, h: S - 80,
            rx: 12,
            strokeWidth: 1.5,
            filled: false,
          },
          // Title text, centered. Text element y is top-left;
          // shift up by fontSize/2 to vertically center on cy.
          {
            id: newElementId(),
            name: 'title',
            type: 'text',
            text: titleText,
            x: cx - titleHalfW, y: cy - titleFontSize / 2 - 14,
            fontSize: titleFontSize,
            fontFamily: DEFAULT_STAMP_FONT_KEY,
            bold: true,
            uppercase: true,
            letterSpacing: 4,
          },
          // Horizontal rule under the title.
          {
            id: newElementId(),
            name: 'rule',
            type: 'line',
            x1: cx - 50, y1: cy + 14, x2: cx + 50, y2: cy + 14,
            strokeWidth: 2,
          },
          // Subtitle, centered beneath the rule.
          {
            id: newElementId(),
            name: 'subtitle',
            type: 'text',
            text: subtitleText,
            x: cx - subtitleHalfW, y: cy + 22,
            fontSize: subtitleFontSize,
            fontFamily: DEFAULT_STAMP_FONT_KEY,
            italic: true,
          },
        ],
      }
    },
  },
]

export const BLANK_PRESET: PresetEntry = {
  key: 'blank',
  label: 'Start blank',
  hint: 'Empty canvas — add elements yourself.',
  build: () => ({
    version: 1,
    surface: { w: S, h: S },
    elements: [],
  }),
}
