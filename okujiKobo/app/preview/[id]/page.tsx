import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { PassportViewer } from '@/components/explore/PassportViewer'
import { PreviewAutosize } from '@/components/explore/PreviewAutosize'
import type { ViewerPage } from '@/components/explore/PageView'
import type { ViewerCover } from '@/components/explore/CoverFrontView'
import type { DesignerPageElement } from '@/lib/design/types'

// Public, chrome-free passport flip-through — designed to be EMBEDDED (iframe)
// on the okuji.app landing page. It reuses the same Explore flipper
// (PassportViewer) and the same public, anon read of a PUBLISHED passport's
// design data (pages + stops), exposing ONLY public design fields — no user /
// journal / collected data. Just the book, on paper; the surrounding copy
// lives on the landing side so this stays calm and integrated.
//
// This route is public (added to the middleware allowlist) and framable only by
// okuji.app (frame-ancestors header in next.config.js). It reads the passport
// id straight from the URL, so the embed's iframe src is where the id is
// configured — not buried in code.

export const metadata: Metadata = {
  title: 'Passport preview · okuji',
  // Embed surface — keep it out of search results; the landing page is the
  // indexable page.
  robots: { index: false, follow: false },
}

export default async function PassportPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Public read: PUBLISHED, non-distribution-only passports only (RLS
  // passports_read_published). A draft / consumable / unknown id → notFound.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: passport } = await (supabase as any)
    .from('passports')
    .select(
      'id, title, cover_bg_color, cover_emblem, cover_outside_data, ' +
        'cover_image_url, page_image_urls',
    )
    .eq('id', id)
    .eq('is_published', true)
    .eq('distribution_only', false)
    .maybeSingle() as {
      data: {
        id: string; title: string; cover_bg_color: string | null; cover_emblem: string | null
        cover_outside_data: Record<string, unknown> | null
        cover_image_url: string | null; page_image_urls: string[] | null
      } | null
    }

  if (!passport) notFound()

  // Base pages only (no closed pages, no opt-in expansion pages) — same shape
  // the Explore viewer pulls.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: pagesRaw } = await (supabase as any)
    .from('passport_pages')
    .select(
      'id, page_order, page_type, section_title, section_name, section_subtitle, ' +
        'prize_description, prize_location_constraint, ' +
        'background_type, background_color, background_opacity, background_image_url, ' +
        'custom_background_opacity, paper_color, elements',
    )
    .eq('passport_id', id)
    .is('closed_at', null)
    .is('expansion_id', null)
    .order('page_order', { ascending: true }) as { data: Record<string, unknown>[] | null }

  const pageIds = ((pagesRaw ?? []) as { id: string }[]).map((p) => p.id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: stopsRaw } =
    pageIds.length > 0
      ? (await (supabase as any)
          .from('stops')
          .select(
            'id, name, stop_order, page_id, stamp_icon, stamp_color, ' +
              'stamp_type, stamp_asset_id, ' +
              'box_x, box_y, box_width, box_height, rotation',
          )
          .in('page_id', pageIds)
          .order('stop_order', { ascending: true })) as { data: Record<string, unknown>[] | null }
      : { data: [] as Record<string, unknown>[] }

  // Resolve CUSTOM stamp artwork for display. The design-assets bucket is public
  // (migration 008), so design_assets.url is a public URL — but the design_assets
  // TABLE is owner-only RLS, so an anon visitor can't read it. Resolve it here
  // with the service role (server-only): a narrow read of just the stamp assets
  // referenced by THIS published passport's stops. Exposes only public design
  // URLs — no private data. Emoji stops need nothing.
  const assetIds = Array.from(new Set(
    ((stopsRaw ?? []) as Record<string, unknown>[])
      .filter((s) => s['stamp_type'] === 'custom_asset' && s['stamp_asset_id'])
      .map((s) => s['stamp_asset_id'] as string),
  ))
  const assetUrlById = new Map<string, string>()
  if (assetIds.length > 0) {
    const svcUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (svcUrl && svcKey) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const svc = createServiceClient(svcUrl, svcKey, { auth: { persistSession: false } }) as any
      const { data: assets } = await svc
        .from('design_assets')
        .select('id, url')
        .in('id', assetIds)
      for (const a of (assets ?? []) as { id: string; url: string | null }[]) {
        if (a.url) assetUrlById.set(a.id, a.url)
      }
    }
  }

  const viewerPages: ViewerPage[] = ((pagesRaw ?? []) as Record<string, unknown>[]).map((r) => {
    const pageId = r['id'] as string
    const stops = ((stopsRaw ?? []) as Record<string, unknown>[])
      .filter((s) => s['page_id'] === pageId)
      .sort((a, b) => (a['stop_order'] as number) - (b['stop_order'] as number))
      .map((s) => ({
        id:          s['id']          as string,
        name:        s['name']        as string,
        box_x:       s['box_x']       as number | null,
        box_y:       s['box_y']       as number | null,
        box_width:   s['box_width']   as number | null,
        box_height:  s['box_height']  as number | null,
        rotation:    s['rotation']    as number | null,
        stamp_icon:  s['stamp_icon']  as string | null,
        stamp_color: s['stamp_color'] as string | null,
        stampImageUrl:
          s['stamp_type'] === 'custom_asset' && s['stamp_asset_id']
            ? assetUrlById.get(s['stamp_asset_id'] as string) ?? null
            : null,
      }))
    return {
      id:                        pageId,
      page_order:                r['page_order']                as number,
      page_type:                 (r['page_type'] as 'stamp' | 'information') ?? 'stamp',
      section_name:              r['section_name']              as string,
      section_title:             r['section_title']             as string | null,
      section_subtitle:          r['section_subtitle']          as string | null,
      prize_description:         r['prize_description']         as string | null,
      prize_location_constraint: r['prize_location_constraint'] as string | null,
      background_type:           (r['background_type'] ?? 'none') as ViewerPage['background_type'],
      background_color:          r['background_color']          as string | null,
      background_opacity:        r['background_opacity']        as number | null,
      background_image_url:      r['background_image_url']      as string | null,
      custom_background_opacity: r['custom_background_opacity'] as number | null,
      paper_color:               r['paper_color']               as string | null,
      elements:                  ((r['elements'] as DesignerPageElement[] | null) ?? []),
      stops,
    }
  })

  const cd = passport.cover_outside_data
  const viewerCover: ViewerCover | null = cd
    ? {
        front_bg:         (cd['front_bg']        as string | null) ?? null,
        back_bg:          (cd['back_bg']         as string | null) ?? null,
        image_url:        (cd['image_url']       as string | null) ?? null,
        image_opacity:    (cd['image_opacity']   as number)        ?? 80,
        image_position_x: (cd['image_position_x'] as number)       ?? 0.5,
        image_position_y: (cd['image_position_y'] as number)       ?? 0.5,
        image_scale:      (cd['image_scale']     as number)        ?? 1,
        elements:         ((cd['elements'] as DesignerPageElement[] | null) ?? []),
      }
    : null

  // Chrome-free: just the book on paper. Height is reported to the embedding
  // okuji.app iframe (PreviewAutosize) so it sizes to the flipper — no
  // min-h-screen, so the frame isn't padded to a full viewport.
  return (
    <main className="bg-paper">
      <PreviewAutosize>
        <PassportViewer
          cover={viewerCover}
          pages={viewerPages}
          fallbackBg={passport.cover_bg_color}
          emblem={passport.cover_emblem}
          title={passport.title}
          coverImageUrl={passport.cover_image_url}
          // Force page LIVE-render (null), not the pre-rendered PNGs: those bake
          // the emoji stamp_icon, so custom stamp artwork would be hidden. Live
          // render draws ReadOnlyStop with the resolved stampImageUrl. Cover has
          // no stamps, so its pre-rendered image is kept.
          pageImageUrls={null}
        />
      </PreviewAutosize>
    </main>
  )
}
