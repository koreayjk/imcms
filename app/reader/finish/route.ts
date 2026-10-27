import { NextRequest, NextResponse } from 'next/server'
import { readToken, safeNext, setReaderCookie } from '@/lib/reader'

// 구글 로그인을 마친 독자를 원래 홈페이지 주소로 돌려보낸 뒤 로그인 쿠키를 만든다 (쿠키는 매체 주소마다 따로라서)
export async function GET(req: NextRequest) {
  const d = readToken('reader-finish', req.nextUrl.searchParams.get('t'))
  const home = new URL('/', req.nextUrl.origin)
  if (!d) return NextResponse.redirect(new URL('/?reader=expired', home))
  await setReaderCookie(d.id)
  return NextResponse.redirect(new URL(safeNext(d.next), home))
}
