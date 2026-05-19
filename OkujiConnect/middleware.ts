import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Use getSession() here (no network call) to decide routing.
  // getUser() makes an outbound call to the Supabase auth API which can fail
  // unreliably in the Edge Runtime. The layout runs in Node.js and calls
  // getUser() there, which is the authoritative security check.
  const { data: { session } } = await supabase.auth.getSession()

  const { pathname } = request.nextUrl

  // OkujiConnect requires login for all pages except auth routes, public passport
  // pages (share tokens), and the explore section.
  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/auth/') ||      // OAuth callback — must be reachable before session exists
    pathname.startsWith('/share/') ||
    pathname.startsWith('/explore') ||
    pathname.startsWith('/passport/') ||
    pathname.startsWith('/creator/') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/')

  if (!session && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  // Forward the current pathname in a header so server components can read it
  // for active-link highlighting in AppNav.
  supabaseResponse.headers.set('x-pathname', pathname)

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
