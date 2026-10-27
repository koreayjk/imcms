import { NextRequest, NextResponse } from 'next/server'
import { anonClient, readToken, safeNext, setReaderCookie } from '@/lib/reader'
import { paymentDbSecret } from '@/lib/toss'

// 이메일 로그인 확인 링크: 메일의 버튼을 누르면 로그인되고 보던 기사로 돌아간다
export async function GET(req: NextRequest) {
  const d = readToken('reader-email', req.nextUrl.searchParams.get('t'))
  const home = new URL('/', req.nextUrl.origin)
  if (!d) return NextResponse.redirect(new URL('/?reader=expired', home))
  const { data } = await anonClient().rpc('reader_upsert', { secret: paymentDbSecret(), p_email: d.email, p_name: d.name, p_provider: 'email' })
  if (typeof data !== 'string') return NextResponse.redirect(new URL('/?reader=blocked', home))
  await setReaderCookie(data)
  return NextResponse.redirect(new URL(safeNext(d.next), home))
}
