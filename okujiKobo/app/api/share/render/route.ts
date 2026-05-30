import { NextRequest, NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'

// SEC-06: user-controlled fields (passport title, emblem, bg color,
// display name) are interpolated into the SVG response below. Without
// escaping, a creator could put `<script>` or an `onload=` SVG event
// handler in their passport title and have it execute when a viewer
// fetches the raw share URL (served as image/svg+xml, same-origin).
// The long-term fix is moving to @vercel/og or node-canvas per the
// TODO further down; this is the interim escape-on-interpolation fix.
function escapeSvg(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Server-side share image generation.
// Returns a simple SVG for MVP — replace with @vercel/og or canvas for production.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { passportId } = (await request.json()) as { passportId: string }

  const { data: passport } = await supabase
    .from('passports')
    .select('title, cover_bg_color, cover_emblem, creator_id, proprietor_id, is_published')
    .eq('id', passportId)
    .single() as {
      data: {
        title: string
        cover_bg_color: string | null
        cover_emblem: string | null
        creator_id: string
        proprietor_id: string | null
        is_published: boolean
      } | null
    }

  if (!passport) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Authorization: caller must be allowed to read this passport. Branches:
  //   1. Caller owns the passport (creator_id = auth.uid())
  //   2. The passport is published (is_published = true)
  //   3. Caller is a platform admin
  //   4. Caller is an employee at the passport's proprietor institution
  // Return 404 (not 403) when no branch matches, so we don't leak existence.
  let authorized = passport.creator_id === user.id || passport.is_published
  if (!authorized) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: isAdminRpc } = await (supabase as any).rpc('is_platform_admin')
    if (isAdminRpc) authorized = true
  }
  if (!authorized && passport.proprietor_id) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: empCount } = await (supabase as any)
      .from('employee_authorizations')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('institution_id', passport.proprietor_id)
    if (empCount && empCount > 0) authorized = true
  }
  if (!authorized) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const bgColor = escapeSvg(`#${passport.cover_bg_color ?? '0D1B2A'}`)
  const emblem = escapeSvg(passport.cover_emblem ?? '🧭')
  const name = escapeSvg(profile?.display_name ?? 'Collector')
  const title = escapeSvg(passport.title)

  // Generate SVG share image (1080×1080)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
    <rect width="1080" height="1080" fill="${bgColor}"/>
    <text x="540" y="420" font-size="180" text-anchor="middle" dominant-baseline="middle">${emblem}</text>
    <text x="540" y="600" font-size="52" font-family="Georgia,serif" font-weight="bold" fill="#F5F0E8" text-anchor="middle">${title}</text>
    <text x="540" y="680" font-size="32" font-family="Georgia,serif" fill="#C9A84C" text-anchor="middle">collected by ${name}</text>
    <text x="980" y="1040" font-size="24" font-family="sans-serif" fill="#FFFFFF80" text-anchor="end">Okuji</text>
  </svg>`

  // In production: use @vercel/og or node-canvas for proper image rendering.
  // TODO: replace SVG with PNG render using canvas or Satori. Until then,
  // user-controlled fields above are run through escapeSvg() (SEC-06).

  // Create a share token — 16 bytes of crypto-random entropy (~128 bits),
  // encoded as 22-char base64url. share_tokens.token is text/unique, so the
  // existing 8-char Math.random() tokens in the DB remain valid.
  const token = randomBytes(16).toString('base64url')
  await supabase.from('share_tokens').insert({ user_id: user.id, passport_id: passportId, token })

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
