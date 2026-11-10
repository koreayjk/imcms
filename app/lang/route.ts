import { NextResponse, type NextRequest } from 'next/server'
import { LANG_COOKIE } from '@/lib/public-data'

// 홈페이지의 "한글 | English" 버튼: 언어를 쿠키에 기억하고 보던 화면으로 되돌려 보낸다 (번역을 켠 매체만 영어판이 보인다)
export function GET(req: NextRequest) {
  const to = req.nextUrl.searchParams.get('to') === 'en' ? 'en' : 'ko'
  const next = req.nextUrl.searchParams.get('next') ?? '/'
  const safe = next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/lang') ? next : '/'
  const res = NextResponse.redirect(new URL(safe, req.nextUrl.origin), 303)
  if (to === 'en') res.cookies.set(LANG_COOKIE, 'en', { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
  else res.cookies.delete(LANG_COOKIE)
  res.headers.set('Cache-Control', 'no-store')
  return res
}
