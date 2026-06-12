'use client'

// Publish-time orchestrator. Renders the front cover and every page
// to PNG in the publisher's browser, uploads to the passport-pages
// Supabase Storage bucket, then writes the URL set onto the passport
// row so /explore/[id] can serve them.
//
// Republish behaviour: overwrites at the same paths (upsert=true) so
// /cover.png and /page-{order}.png are always the current set. The
// row's cover_image_url + page_image_urls get replaced wholesale.
//
// Failure mode: if a single page fails to render or upload we log and
// continue. The publish itself is already done before this runs, so
// the user isn't blocked by an image-pipeline hiccup — Explore falls
// back to live-render for any URL slot that's null. Subsequent
// republish will retry.

import { createClient } from '@/lib/supabase/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { svgStringToPngBlob, urlToDataUri } from './render-to-png'
import { PageSvg, PAGE_W, PAGE_H, type PageSvgInput, type PageSvgStop } from './svg/PageSvg'
import { CoverSvg, type CoverSvgInput } from './svg/CoverSvg'
import type {
  DesignerPassport,
  DesignerPassportPage,
  DesignerStop,
  DesignerPageElement,
} from '@/lib/design/types'

const BUCKET = 'passport-pages'

interface RenderResult {
  cover_image_url: string | null
  page_image_urls: string[]
  errors: string[]
}

export async function generateAndUploadPassportImages(
  passport: DesignerPassport,
  pages: DesignerPassportPage[],
  stops: DesignerStop[],
): Promise<RenderResult> {
  const supabase = createClient()
  const errors: string[] = []

  // ── Cover ────────────────────────────────────────────────────────────────
  let cover_image_url: string | null = null
  try {
    const cover = passport.cover_outside_data ?? null
    const coverInput: CoverSvgInput = {
      front_bg:         cover?.front_bg ?? null,
      back_bg:          cover?.back_bg ?? null,
      image_url:        cover?.image_url
        ? await urlToDataUri(cover.image_url)
        : null,
      image_opacity:    cover?.image_opacity ?? 80,
      image_position_x: cover?.image_position_x ?? 0.5,
      image_position_y: cover?.image_position_y ?? 0.5,
      image_scale:      cover?.image_scale ?? 1,
      elements:         await inlineImageElementUrls(cover?.elements ?? []),
      fallbackBg:       passport.cover_bg_color ?? null,
      emblem:           passport.cover_emblem ?? null,
      title:            passport.title,
    }
    const svg = renderToStaticMarkup(<CoverSvg cover={coverInput} />)
    const blob = await svgStringToPngBlob(svg, PAGE_W, PAGE_H)
    cover_image_url = await uploadBlob(supabase, passport.id, 'cover.png', blob)
  } catch (err) {
    errors.push(`cover: ${err instanceof Error ? err.message : String(err)}`)
  }

  // ── Pages ────────────────────────────────────────────────────────────────
  // Sequential — keeps memory bounded (each page allocates a canvas
  // and a blob) and serializes the storage uploads so the page-images
  // bucket never sees 20 parallel writes.
  const orderedPages = [...pages].sort((a, b) => a.page_order - b.page_order)
  const page_image_urls: string[] = new Array(orderedPages.length).fill(null) as unknown as string[]

  for (let i = 0; i < orderedPages.length; i++) {
    const page = orderedPages[i]
    try {
      const pageStops: PageSvgStop[] = stops
        .filter((s) => s.page_id === page.id)
        .sort((a, b) => a.stop_order - b.stop_order)
        .map((s) => ({
          id:           s.id,
          box_x:        s.box_x ?? null,
          box_y:        s.box_y ?? null,
          box_width:    s.box_width ?? null,
          box_height:   s.box_height ?? null,
          rotation:     s.rotation ?? null,
          stamp_icon:   s.stamp_icon ?? null,
        }))

      const input: PageSvgInput = {
        id:                         page.id,
        paper_color:                page.paper_color ?? null,
        background_type:            page.background_type ?? 'none',
        background_color:           page.background_color ?? null,
        background_opacity:         page.background_opacity ?? null,
        background_image_url:       page.background_image_url
          ? await urlToDataUri(page.background_image_url)
          : null,
        custom_background_opacity:  page.custom_background_opacity ?? null,
        elements:                   await inlineImageElementUrls(page.elements ?? []),
        stops:                      pageStops,
      }
      const svg = renderToStaticMarkup(<PageSvg page={input} />)
      const blob = await svgStringToPngBlob(svg, PAGE_W, PAGE_H)
      const url = await uploadBlob(supabase, passport.id, `page-${page.page_order}.png`, blob)
      page_image_urls[i] = url
    } catch (err) {
      errors.push(`page ${page.page_order}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // ── Write URLs onto the passport row ────────────────────────────────────
  // Use a direct supabase update (NOT updatePassport from the store) so
  // we don't flip isDirty=true and re-trigger the autosave/persist
  // chain for what is now a server-side artifact, not user content.
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { error } = await db
      .from('passports')
      .update({
        cover_image_url,
        page_image_urls: page_image_urls.filter((u) => typeof u === 'string'),
      })
      .eq('id', passport.id)
    if (error) errors.push(`row update: ${error.message}`)
  } catch (err) {
    errors.push(`row update: ${err instanceof Error ? err.message : String(err)}`)
  }

  return { cover_image_url, page_image_urls, errors }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function uploadBlob(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  passportId: string,
  filename: string,
  blob: Blob,
): Promise<string> {
  const path = `${passportId}/${filename}`
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/png', upsert: true })
  if (error) throw new Error(`storage upload failed: ${error.message}`)
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  // Append a cache-buster so subsequent republishes are picked up by
  // browsers that have the old image cached. The URL stored in the
  // DB carries the timestamp so the Explore viewer's <img src=…>
  // automatically pulls the fresh bytes.
  return `${data.publicUrl}?v=${Date.now()}`
}

async function inlineImageElementUrls(
  elements: DesignerPageElement[],
): Promise<DesignerPageElement[]> {
  const out: DesignerPageElement[] = []
  for (const el of elements) {
    if ((el.type === 'image' || el.type === 'layout') && el.imageUrl) {
      out.push({ ...el, imageUrl: await urlToDataUri(el.imageUrl) })
    } else {
      out.push(el)
    }
  }
  return out
}
