# public/stamp-icons/

Static SVG icon swap directory. Files here are referenced by path from app code
(e.g. `<img src="/stamp-icons/loop-design.svg" />`). Replacing a file at the
same path swaps the visual without touching any TS/TSX source.

## Current contents

| File | Where it's used | Status |
|---|---|---|
| `loop-design.svg`  | Welcome modal — Design step  | seeded from lucide `PencilRuler` |
| `loop-publish.svg` | Welcome modal — Publish step | seeded from lucide `Send` |
| `loop-collect.svg` | Welcome modal — Collect step | seeded from lucide `MapPin` |
| `loop-print.svg`   | Welcome modal — Print step   | seeded from lucide `Printer` |

## Conventions

- Stroke = `currentColor` (consumers color via `text-*` tokens — usually `text-ink`).
- ViewBox = `0 0 24 24` matching lucide so the consumer's height/width values stay valid.
- Single-stroke, no fill, `stroke-linecap` + `stroke-linejoin` both `round`.
- Stroke width 1.75 — slightly lighter than lucide's default 2 to read as drawn-by-hand.
- `aria-hidden="true"` on the root — the parent label provides the semantic name.

## How to swap

Drop a hand-drawn replacement at the exact filename. No code change required.
The stamp-composer fallback path (`lib/design/stamp-composer/icons/render.ts`)
follows the same convention for non-welcome icons.
