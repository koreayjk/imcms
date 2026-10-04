import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// 인증 메일 링크가 돌아오는 곳 (Supabase 메일 템플릿: {{ .TokenHash }} 를 담은 우리 주소 링크)
//   링크 주소가 보낸 도메인과 같아 스팸으로 덜 분류되고, 가입한 브라우저가 아니어도 인증된다
const TYPES: EmailOtpType[] = ['signup', 'email', 'invite', 'magiclink', 'recovery', 'email_change']

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/newsroom'
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/newsroom'

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) return NextResponse.redirect(new URL(safeNext, origin))
  }
  const url = new URL('/login', origin)
  url.searchParams.set('error', '인증 링크가 만료되었거나 이미 사용되었습니다. 로그인해 보시고, 안 되면 인증 메일을 다시 받아 주세요.')
  return NextResponse.redirect(url)
}
