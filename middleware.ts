import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { ensureUserRow } from '@/lib/users'

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // UPDATED LOGIC: Protect both /dashboard and /settings
  const isProtectedRoute =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/settings')

  if (!user && isProtectedRoute) {
    const signIn = new URL('/sign-in', request.url)
    const returnTo = `${pathname}${request.nextUrl.search ?? ''}`
    signIn.searchParams.set('callbackUrl', returnTo)
    return NextResponse.redirect(signIn)
  }

  if (
    user &&
    isProtectedRoute &&
    !pathname.startsWith('/api') &&
    !pathname.startsWith('/settings/name')
  ) {
    await ensureUserRow(supabase, user)
    const { data: urow, error: uerr } = await supabase
      .from('users')
      .select('names')
      .eq('id', user.id)
      .maybeSingle()

    if (!uerr && urow?.names=== true) {
      return NextResponse.redirect(new URL('/settings/name', request.url))
    }
  }

  return response
}

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api/x/oauth/callback (Specific route)
     * - api/./callback (Any route ending in /callback inside api)
     * - _next/static, _next/image, favicon.ico, and images
     */
    '/((?!api/x/oauth/callback|api/.*/callback|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}




