import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

// Mimics exactly what middleware does — no Edge runtime differences.
export async function GET() {
  const cookieStore = await cookies()
  const allCookies = cookieStore.getAll()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => allCookies,
        setAll: () => {},
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()

  const authCookies = allCookies
    .filter(c => c.name.startsWith('sb-'))
    .map(c => ({ name: c.name, valueLength: c.value.length }))

  return NextResponse.json({
    user: user ? { id: user.id, email: user.email } : null,
    error: error?.message ?? null,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'MISSING',
    supabaseKeyPresent: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    authCookiesFound: authCookies,
    totalCookies: allCookies.length,
  })
}
