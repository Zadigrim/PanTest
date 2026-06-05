/**
 * Render a lucide icon component to its inner SVG markup so the
 * composer can EMBED the path data directly into the saved stamp
 * SVG (self-contained: the stamp file renders without needing
 * lucide at view time).
 *
 * Strategy:
 *   - renderToStaticMarkup (react-dom/server) renders the icon
 *     component to a string `<svg viewBox=…>…</svg>`.
 *   - We capture the viewBox attribute + everything between
 *     <svg…> and </svg> as the inner content.
 *   - Cache by iconKey so the picker doesn't re-render the same
 *     icon on every preview.
 *
 * Future hook for `public/stamp-icons/<key>.svg`:
 *   resolveCustomIcon() — fetches a static SVG file if present;
 *   returns null otherwise. When the custom okuji set lands as
 *   files in public/stamp-icons/, the IconPicker prefers those
 *   first.
 */

import type { LucideIcon } from 'lucide-react'
import { createElement } from 'react'

const RENDER_CACHE = new Map<string, { viewBox: string; inner: string }>()

/**
 * Render a lucide component to { viewBox, inner }. Strips the
 * outer <svg> wrapper because the composer wraps the icon in
 * its own positioning <g transform=…> at canvas + serialize
 * time.
 */
export async function renderLucideToInner(
  iconKey: string,
  Component: LucideIcon,
): Promise<{ viewBox: string; inner: string }> {
  const cached = RENDER_CACHE.get(iconKey)
  if (cached) return cached

  // Dynamic import keeps react-dom/server out of the main bundle;
  // the composer modal is the only consumer.
  const { renderToStaticMarkup } = await import('react-dom/server')
  const markup = renderToStaticMarkup(
    // strokeWidth left at lucide default so the picker preview
    // matches what the user will get on the canvas at default
    // weight. The composer's icon element carries its own
    // strokeWidth that overrides at render time.
    createElement(Component, { stroke: 'currentColor' }),
  )

  const match = markup.match(/<svg([^>]*)>([\s\S]*)<\/svg>/)
  const attrs = match?.[1] ?? ''
  const inner = match?.[2] ?? ''
  const vbMatch = attrs.match(/viewBox="([^"]+)"/)
  const viewBox = vbMatch?.[1] ?? '0 0 24 24'

  const result = { viewBox, inner }
  RENDER_CACHE.set(iconKey, result)
  return result
}

/**
 * Stub for the future `public/stamp-icons/<key>.svg` swap. Always
 * returns null today; flips to a fetch-and-parse path once the
 * custom okuji set is committed. Keeping the surface here so the
 * IconPicker call site is already in the right shape.
 */
export async function resolveCustomIcon(
  iconKey: string,
): Promise<{ viewBox: string; inner: string } | null> {
  // TODO: when okuji-icons land in public/stamp-icons/, attempt:
  //   const res = await fetch(`/stamp-icons/${iconKey}.svg`)
  //   parse the <svg> wrapper for viewBox; return { viewBox, inner }
  // Until then this no-ops so the lucide fallback fires.
  void iconKey
  return null
}
