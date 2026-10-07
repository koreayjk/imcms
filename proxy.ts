import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { APP_PATHS, PRODUCT, isAppHost, isProductHost } from '@/lib/product'
import { isGdpaHost } from '@/lib/gdpa'
import { hasVerifiedFactor, mfaSession, tokenClaims } from '@/lib/mfa'

// 로그인 기록(login-security.sql): 이 브라우저에서 이미 남긴 로그인 번호. 새 로그인일 때만 DB에 한 번 남긴다
const LOGIN_COOKIE = 'im_sid'

// 로그인 없이 볼 수 있는 공개 경로
function isPublicPath(pathname: string) {
  return (
    pathname === '/' ||
    pathname === '/news' ||
    // 기사 미리보기 링크: 서버가 만든 서명이 맞을 때만 보인다
    pathname.startsWith('/p/') ||
    pathname.startsWith('/news/') ||
    pathname.startsWith('/section/') ||
    pathname === '/search' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    // 체험 신청·체험 종료 안내 (trial.sql)
    pathname === '/trial' || pathname.startsWith('/trial/') ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith(PRODUCT.path) ||
    // 글로벌디지털언론협회(GDPA) 사이트: 협회 회원 로그인은 사이트 안에서 따로 확인한다
    pathname === '/gdpa' || pathname.startsWith('/gdpa/') ||
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

export async function proxy(request: NextRequest) {
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

  // 편집국 주소(app.imnewsroom.com)의 첫 화면은 편집국 (로그인 전이면 로그인 화면으로 넘어간다)
  const host = request.headers.get('host')
  if (isAppHost(host) && request.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/newsroom', request.url))
  }
  // 소개 사이트(imnewsroom.com)에서 연 로그인·체험·편집국 화면은 편집국 주소로 (로그인은 주소마다 따로라 한 곳으로 모은다)
  if (PRODUCT.appLive && isProductHost(host)) {
    const p = request.nextUrl.pathname
    if (APP_PATHS.some((x) => p === x || p.startsWith(`${x}/`))) {
      return NextResponse.redirect(`${PRODUCT.appUrl}${p}${request.nextUrl.search}`)
    }
  }

  // 제품 홈페이지 도메인으로 들어온 첫 화면은 IM 뉴스룸 소개 페이지로 보여준다
  if (request.nextUrl.pathname === '/' && isProductHost(request.headers.get('host'))) {
    const url = request.nextUrl.clone()
    url.pathname = PRODUCT.path
    return NextResponse.rewrite(url)
  }

  // GDPA 도메인으로 들어오면 /gdpa 아래 화면을 보여준다 (로그인 확인·결제 콜백 등 /api·/auth 는 그대로)
  let rewriteTo: URL | null = null
  {
    const p = request.nextUrl.pathname
    if (isGdpaHost(request.headers.get('host')) && !p.startsWith('/gdpa') && !p.startsWith('/api/') && !p.startsWith('/auth/') && !p.startsWith('/_next')) {
      rewriteTo = request.nextUrl.clone()
      rewriteTo.pathname = `/gdpa${p === '/' ? '' : p}`
    }
  }
  const pass = () => (rewriteTo ? NextResponse.rewrite(rewriteTo, { request }) : NextResponse.next({ request }))

  // Supabase 미연결(미리보기) 상태에서는 공개 페이지만 샘플 데이터로 보여준다
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return pass()

  let supabaseResponse = pass()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = pass()
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  // GDPA 도메인의 화면은 모두 협회 사이트 경로로 본다
  const pathname = rewriteTo ? rewriteTo.pathname : request.nextUrl.pathname

  // CMS 경로는 로그인 필요
  if (!user && !isPublicPath(pathname)) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && !isPublicPath(pathname) && !pathname.startsWith('/api/')) {
    const { data: { session } } = await supabase.auth.getSession()

    // 새 로그인(기기·브라우저마다)이면 시각·IP·브라우저를 로그인 기록에 남긴다 (SQL 전이면 조용히 넘어간다)
    const sid = tokenClaims(session?.access_token).session_id
    const fresh = !!sid && request.cookies.get(LOGIN_COOKIE)?.value !== sid
    if (fresh) {
      const ip = request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
      await supabase.rpc('record_login', { p_ip: ip, p_ua: request.headers.get('user-agent') ?? '' }).then(() => null, () => null)
    }
    const remember = (res: NextResponse) => {
      if (fresh) res.cookies.set(LOGIN_COOKIE, sid!, { path: '/', httpOnly: true, secure: request.nextUrl.protocol === 'https:', sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 })
      return res
    }

    // 2단계 인증을 켠 사람이 아직 6자리 코드를 안 넣었으면 코드 입력 화면으로 (DB도 코드 전에는 자료를 주지 않는다)
    if (hasVerifiedFactor(user) && !mfaSession(session?.access_token).aal2) {
      const url = request.nextUrl.clone()
      url.pathname = '/login/mfa'
      url.search = `?next=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`
      const res = NextResponse.redirect(url)
      // 방금 새로 받은 로그인 쿠키를 잃지 않게 옮겨 담는다
      supabaseResponse.cookies.getAll().forEach((c) => res.cookies.set(c))
      return remember(res)
    }
    return remember(supabaseResponse)
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
