import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 로그인 없이 볼 수 있는 공개 경로
function isPublicPath(pathname: string) {
  return (
    pathname === '/' ||
    pathname.startsWith('/news/') ||
    pathname.startsWith('/section/') ||
    pathname === '/search' ||
    pathname.startsWith('/login') ||
    // 예약 수집: 로그인 대신 DB 비밀 열쇠로 확인한다
    pathname.startsWith('/api/cron/')
  )
}

export async function middleware(request: NextRequest) {
  // Supabase 미연결(미리보기) 상태에서는 공개 페이지만 샘플 데이터로 보여준다
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.next()

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  // CMS 경로는 로그인 필요
  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // 로그인 상태에서 /login 접근 → CMS로
  if (user && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/newsroom'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
