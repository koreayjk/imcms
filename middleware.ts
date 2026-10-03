import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { PRODUCT, isProductHost } from '@/lib/product'

// 로그인 없이 볼 수 있는 공개 경로
function isPublicPath(pathname: string) {
  return (
    pathname === '/' ||
    pathname === '/news' ||
    pathname.startsWith('/news/') ||
    pathname.startsWith('/section/') ||
    pathname === '/search' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith(PRODUCT.path) ||
    // AI 초안 검토 링크: 토큰을 아는 사람만 (DB 함수로 확인)
    pathname.startsWith('/ai-review/') ||
    // 예약 수집: 로그인 대신 DB 비밀 열쇠로 확인한다
    pathname.startsWith('/api/cron/') ||
    // 메일 수신 서비스: DB 비밀 열쇠로 확인한다
    pathname.startsWith('/api/inbound/') ||
    // 토스페이먼츠 웹훅: 받은 내용을 믿지 않고 결제를 다시 조회한다
    pathname === '/api/payments/webhook' ||
    pathname === '/api/payments/stripe-webhook' ||
    // 기사 조회수 (독자가 부른다)
    pathname === '/api/view' ||
    // 뉴스레터 구독 확인·수신거부 (메일 속 링크)
    pathname.startsWith('/newsletter/') ||
    pathname === '/api/newsletter/unsubscribe' ||
    // 광고 배너 클릭·노출 (독자가 부른다)
    pathname.startsWith('/ad/') ||
    pathname === '/api/ad-view' ||
    // 정책 페이지·사이트맵·RSS (공개)
    pathname.startsWith('/policy/') ||
    pathname === '/sitemap.xml' ||
    pathname === '/news-sitemap.xml' ||
    pathname === '/rss.xml' ||
    pathname === '/robots.txt'
  )
}

export async function middleware(request: NextRequest) {
  // 매체 홈페이지 미리보기: ?preview_outlet=매체ID 로 들어오면 쿠키에 기억 (clear면 끝내기)
  const previewParam = request.nextUrl.searchParams.get('preview_outlet')
  if (previewParam) {
    const url = request.nextUrl.clone()
    url.searchParams.delete('preview_outlet')
    const res = NextResponse.redirect(url)
    if (previewParam === 'clear' || !/^[0-9a-f-]{36}$/.test(previewParam)) res.cookies.delete('im_site_preview')
    else res.cookies.set('im_site_preview', previewParam, { path: '/', maxAge: 60 * 60 * 24, sameSite: 'lax' })
    return res
  }

  // 제품 홈페이지 도메인으로 들어온 첫 화면은 IM 뉴스룸 소개 페이지로 보여준다
  if (request.nextUrl.pathname === '/' && isProductHost(request.headers.get('host'))) {
    const url = request.nextUrl.clone()
    url.pathname = PRODUCT.path
    return NextResponse.rewrite(url)
  }

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
  if (user && (pathname === '/login' || pathname === '/signup')) {
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
