import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

type CookieToSet = { name: string; value: string; options?: CookieOptions }

/**
 * Host-based surface isolation (M4.1).
 *
 * Two surfaces share one Next.js app:
 *   - okuji (passport world)         → any host that isn't moichido
 *   - moichido (merchant world)      → host matches MOICHIDO_HOST env var
 *
 * The moichido tree lives under app/moichido/*. Requests to the
 * moichido host get rewritten so /foo → /moichido/foo internally
 * (the URL the user sees stays clean — moichido.app/foo, not
 * moichido.app/moichido/foo). Requests to the okuji host that try
 * to address /moichido/* directly get 404'd.
 *
 * MOICHIDO_HOST is read from the environment. Local dev / Vercel
 * preview / production each set it independently. Unset → no host
 * matches → moichido tree is entirely unreachable (the safe
 * default).
 */
const MOICHIDO_HOST = process.env.MOICHIDO_HOST?.toLowerCase() ?? null

function hostMatches(request: NextRequest): boolean {
  if (!MOICHIDO_HOST) return false
  const host = (request.headers.get('host') ?? '').toLowerCase()
  return host === MOICHIDO_HOST
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const onMoichidoHost = hostMatches(request)

  // ── Surface isolation gate ─────────────────────────────────────
  // Run BEFORE the auth check so the wrong-surface response is the
  // honest 404 / rewrite even if the user is signed out.
  //
  // Internal-only paths (/_next, /api, /auth) are surface-agnostic.
  // /auth/callback is shared by both surfaces — the route handler
  // uses request.origin to build the post-exchange redirect, so it
  // naturally lands the merchant back on moichido.app and the
  // okuji user back on okuji.app from the same handler. Excluding
  // /auth/ from the rewrite is what makes OAuth work on moichido
  // after Supabase's allowlist (Fix A) is in place.
  //
  // /api/moichido/* will get host-checked when those routes ship
  // in M4.3 — for now there are no moichido APIs, so /api stays
  // a shared concern (the okuji-shell-only fetches that already
  // exist run as today).
  const isInternal =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/auth/') ||
    pathname === '/favicon.ico'

  if (!isInternal) {
    if (onMoichidoHost) {
      // moichido host. Anything outside the moichido tree gets
      // rewritten into it. /dashboard → /moichido/dashboard. If
      // the rewritten path doesn't exist (most paths don't yet),
      // Next.js 404s naturally.
      if (!pathname.startsWith('/moichido')) {
        const rewrite = request.nextUrl.clone()
        rewrite.pathname = '/moichido' + (pathname === '/' ? '' : pathname)
        return NextResponse.rewrite(rewrite)
      }
      // Already in the moichido tree — let it through. The /moichido
      // prefix is internal-only; users see clean URLs because of
      // the rewrite above on every other path.
    } else {
      // okuji host (or any unrecognised host). The moichido tree
      // is unreachable: a typed-by-hand /moichido/X URL on the
      // okuji host 404s instead of rendering the moichido shell.
      if (pathname.startsWith('/moichido')) {
        return new NextResponse('Not found', { status: 404 })
      }
    }
  }

  // ── API host gate (M4.3) ───────────────────────────────────────
  // /api/moichido/* is the merchant API surface (cards write, future
  // analytics, etc.). It must be reachable ONLY from the moichido
  // host so a passport-surface client can't call it; conversely
  // /api/* (non-moichido) is unreachable from the moichido host so
  // the merchant shell can't accidentally call into okuji APIs.
  //
  // This runs AFTER the rewrite block above. /auth/* and other
  // shared concerns are not /api/* so unaffected.
  if (pathname.startsWith('/api/')) {
    if (onMoichidoHost && !pathname.startsWith('/api/moichido/')) {
      return new NextResponse('Not found', { status: 404 })
    }
    if (!onMoichidoHost && pathname.startsWith('/api/moichido/')) {
      return new NextResponse('Not found', { status: 404 })
    }
  }

  // ── Auth gate (unchanged from pre-M4.1) ───────────────────────
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet: CookieToSet[]) => {
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

  // OkujiKobo requires login for all pages except auth routes, public passport
  // pages (share tokens), and the explore section. moichido's auth surfaces
  // (/moichido/auth/login, /moichido/auth/denied) stay public; the rest of
  // the moichido tree requires auth as of M4.2.
  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/auth/') ||      // OAuth callback — must be reachable before session exists
    pathname.startsWith('/share/') ||
    pathname.startsWith('/explore') ||
    pathname.startsWith('/preview/') ||   // public, embeddable passport preview (okuji.app iframe)
    pathname.startsWith('/passport/') ||
    pathname.startsWith('/creator/') ||
    pathname.startsWith('/moichido/auth/') || // moichido login + denied page
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/')

  if (!session && !isPublic) {
    const url = request.nextUrl.clone()
    // Host-aware login target: the moichido surface bounces to its
    // own login (M4.2), never to the okuji /login. After Fix D the
    // moichido auth path lives at /moichido/auth/login.
    url.pathname = onMoichidoHost ? '/moichido/auth/login' : '/login'
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
