import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Server-side share image generation.
// Returns a simple SVG for MVP — replace with @vercel/og or canvas for production.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { passportId } = (await request.json()) as { passportId: string }

  const { data: passport } = await supabase
    .from('passports')
    .select('title, cover_bg_color, cover_emblem')
    .eq('id', passportId)
    .single()

  if (!passport) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  const bgColor = `#${passport.cover_bg_color ?? '0D1B2A'}`
  const emblem = passport.cover_emblem ?? '🧭'
  const name = profile?.display_name ?? 'Collector'
  const title = passport.title

  // Generate SVG share image (1080×1080)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
    <rect width="1080" height="1080" fill="${bgColor}"/>
    <text x="540" y="420" font-size="180" text-anchor="middle" dominant-baseline="middle">${emblem}</text>
    <text x="540" y="600" font-size="52" font-family="Georgia,serif" font-weight="bold" fill="#F5F0E8" text-anchor="middle">${title}</text>
    <text x="540" y="680" font-size="32" font-family="Georgia,serif" fill="#C9A84C" text-anchor="middle">collected by ${name}</text>
    <text x="980" y="1040" font-size="24" font-family="sans-serif" fill="#FFFFFF80" text-anchor="end">Okuji</text>
  </svg>`

  // In production: use @vercel/og or node-canvas for proper image rendering
  // TODO: replace SVG with PNG render using canvas or Satori

  // Create a share token
  const token = Math.random().toString(36).slice(2, 10).toUpperCase()
  await supabase.from('share_tokens').insert({ user_id: user.id, passport_id: passportId, token })

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}
