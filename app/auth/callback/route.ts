import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// 구글 로그인·가입 확인 메일 링크가 돌아오는 곳: 받은 코드를 로그인 세션으로 바꾼다
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/newsroom'
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/newsroom'

  const failed = searchParams.get('error_description') ?? searchParams.get('error')
  if (failed || !code) {
    const url = new URL('/login', origin)
    url.searchParams.set('error', failed ?? '로그인 정보를 받지 못했습니다. 다시 시도해 주세요.')
    return NextResponse.redirect(url)
  }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    const url = new URL('/login', origin)
    url.searchParams.set('error', '로그인 링크가 만료되었거나 다른 브라우저에서 열렸습니다. 다시 로그인해 주세요.')
    return NextResponse.redirect(url)
  }
  // 구글 가입: 가입 화면에서 고른 소속 매체를 신청 매체로 기억 (이미 승인된 회원에게는 아무 일도 하지 않는다)
  const outlet = searchParams.get('outlet')
  if (outlet && /^[0-9a-f-]{36}$/.test(outlet)) await supabase.rpc('set_requested_outlet', { o: outlet })
  return NextResponse.redirect(new URL(safeNext, origin))
}
