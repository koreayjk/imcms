import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// 인증 메일 링크가 돌아오는 곳 (Supabase 메일 템플릿: {{ .TokenHash }} 를 담은 우리 주소 링크)
//   링크 주소가 보낸 도메인과 같아 스팸으로 덜 분류되고, 가입한 브라우저가 아니어도 인증된다
//   링크를 열면(GET) 바로 인증하지 않고 "계속" 단추가 있는 화면을 보여 준다. 사람이 단추를 눌러야(POST) 인증한다
//   (메일 앱·보안 검사 프로그램이 링크를 미리 열어 보면 한 번만 쓰는 인증이 먼저 써져 "만료"가 되기 때문)
const TYPES: EmailOtpType[] = ['signup', 'email', 'invite', 'magiclink', 'recovery', 'email_change']

const safe = (next: string | null) => (next && next.startsWith('/') && !next.startsWith('//') ? next : '/newsroom')
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

function failed(origin: string, type: string | null) {
  // 비밀번호 재설정 링크면 재설정 메일을 다시 받는 화면으로, 그 밖에는 로그인 화면으로
  if (type === 'recovery') return NextResponse.redirect(new URL('/login/forgot?expired=1', origin), 303)
  const url = new URL('/login', origin)
  url.searchParams.set('error', '인증 링크가 만료되었거나 이미 사용되었습니다. 로그인해 보시고, 안 되면 인증 메일을 다시 받아 주세요.')
  return NextResponse.redirect(url, 303)
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const tokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  if (!tokenHash || !type || !TYPES.includes(type)) return failed(origin, type)
  const recovery = type === 'recovery'
  const next = recovery && !safe(searchParams.get('next')).endsWith('/reset') ? '/login/reset' : safe(searchParams.get('next'))
  const title = recovery ? '비밀번호 재설정' : '이메일 인증'
  const button = recovery ? '새 비밀번호 정하기' : '이메일 인증 마치기'
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${title} | IM 뉴스룸</title>
<style>body{margin:0;background:#F6F7F9;font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#1a1a1a}
main{max-width:420px;margin:0 auto;padding:72px 24px;text-align:center}img{width:64px;height:64px;border-radius:14px}
h1{font-size:22px;margin:20px 0 8px}p{color:#6b6b6b;font-size:15px;line-height:1.6;margin:0 0 28px}
button{width:100%;border:0;border-radius:10px;background:#1a1a1a;color:#fff;font-size:16px;font-weight:700;padding:15px;cursor:pointer}</style></head>
<body><main><img src="/brand/apple-touch-icon.png" alt=""><h1>${title}</h1><p>아래 단추를 누르면 ${recovery ? '새 비밀번호를 정하는 화면으로 넘어갑니다' : '인증이 끝나고 편집국으로 넘어갑니다'}.</p>
<form method="post" action="/auth/confirm"><input type="hidden" name="token_hash" value="${esc(tokenHash)}"><input type="hidden" name="type" value="${esc(type)}"><input type="hidden" name="next" value="${esc(next)}"><button type="submit">${button}</button></form></main></body></html>`
  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } })
}

export async function POST(request: NextRequest) {
  const { origin } = request.nextUrl
  const form = await request.formData()
  const tokenHash = String(form.get('token_hash') ?? '')
  const type = String(form.get('type') ?? '') as EmailOtpType
  if (!tokenHash || !TYPES.includes(type)) return failed(origin, type)
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
  if (error) return failed(origin, type)
  // 비밀번호 재설정은 메일 템플릿의 next 와 상관없이 늘 새 비밀번호 화면으로 (next 가 빠진 템플릿이면 편집국으로 가 버렸다)
  const next = safe(String(form.get('next') ?? ''))
  const dest = type === 'recovery' && !next.endsWith('/reset') ? '/login/reset' : next
  return NextResponse.redirect(new URL(dest, origin), 303)
}
