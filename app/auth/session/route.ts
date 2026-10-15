import { NextResponse, type NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// 브라우저가 방금 바꾼 로그인 정보(2단계 인증 통과 등)를 서버가 쿠키로 다시 내려 준다 (lib/session-sync.ts)
//   아이폰 앱(WKWebView)은 자바스크립트로 쓴 쿠키를 서버 요청에 늦게 실어 보내, 코드를 넣어도 다시 코드 화면으로 돌아왔다
//   서버 응답(Set-Cookie)으로 받은 쿠키는 바로 쓰인다. 다른 사이트에서 보낸 요청은 받지 않는다(로그인 바꿔치기 방지)
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (!origin || new URL(origin).host !== request.nextUrl.host) return new NextResponse(null, { status: 403 })
  const body = (await request.json().catch(() => null)) as { access_token?: string; refresh_token?: string } | null
  if (!body?.access_token || !body.refresh_token) return new NextResponse(null, { status: 400 })
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.setSession({ access_token: body.access_token, refresh_token: body.refresh_token })
  return new NextResponse(null, { status: error ? 401 : 204, headers: { 'Cache-Control': 'no-store' } })
}
