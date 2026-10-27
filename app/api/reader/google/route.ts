import { NextRequest, NextResponse } from 'next/server'
import { anonClient, googleReady, readToken, safeNext, signToken } from '@/lib/reader'
import { paymentDbSecret } from '@/lib/toss'
import { cmsOrigin } from '@/lib/origin'

// 독자 구글 로그인 (구글 Cloud 콘솔 OAuth 클라이언트: GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET)
//   · 시작: 아무 매체 주소에서 /api/reader/google?next=/news/… → 구글 로그인 화면
//   · 돌아옴: 구글은 하나뿐인 주소(편집국 주소 …/api/reader/google)로 돌려보낸다 → 독자 확인 → 원래 매체 주소의 /reader/finish 로 넘긴다
//     (구글에 등록할 "승인된 리디렉션 URI" 는 편집국 주소 하나: https://app.imnewsroom.com/api/reader/google)
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams
  const fail = (origin = req.nextUrl.origin) => NextResponse.redirect(new URL('/?reader=failed', origin))
  if (!googleReady()) return fail()
  const redirectUri = `${await cmsOrigin()}/api/reader/google`

  // ① 시작
  if (!q.get('code') && !q.get('state')) {
    const state = signToken('reader-google', { origin: req.nextUrl.origin, next: safeNext(q.get('next')) }, 10 * 60)
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
    url.search = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: redirectUri, response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' }).toString()
    return NextResponse.redirect(url)
  }

  // ② 구글에서 돌아옴
  const st = readToken('reader-google', q.get('state'))
  if (!st || !q.get('code')) return fail()
  // 돌아갈 곳은 편집국 주소이거나, 매체로 등록된 주소(도메인)여야 한다
  const origin = st.origin
  let host = ''
  try { host = new URL(origin).hostname.replace(/^www\./, '') } catch { return fail() }
  const appHost = new URL(await cmsOrigin()).hostname
  if (host !== appHost && !/\.vercel\.app$/.test(host)) {
    const { data } = await anonClient().from('outlets').select('id').eq('domain', host).limit(1)
    if (!data?.length) return fail()
  }
  const tok = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code: q.get('code')!, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
  }).then((r) => r.json()).catch(() => null) as { id_token?: string } | null
  if (!tok?.id_token) return fail(origin)
  // 구글이 직접 준 ID 토큰이라 서명 확인 대신 받은 내용만 읽는다 (토큰 교환 응답에서 바로 받은 것)
  let claims: { email?: string; email_verified?: boolean; name?: string; aud?: string }
  try { claims = JSON.parse(Buffer.from(tok.id_token.split('.')[1], 'base64url').toString('utf8')) } catch { return fail(origin) }
  if (!claims.email || claims.email_verified !== true || claims.aud !== process.env.GOOGLE_CLIENT_ID) return fail(origin)
  const { data: rid } = await anonClient().rpc('reader_upsert', { secret: paymentDbSecret(), p_email: claims.email, p_name: claims.name ?? '', p_provider: 'google' })
  if (typeof rid !== 'string') return NextResponse.redirect(new URL('/?reader=blocked', origin))
  const t = signToken('reader-finish', { id: rid, next: safeNext(st.next) }, 120)
  return NextResponse.redirect(new URL(`/reader/finish?t=${encodeURIComponent(t)}`, origin))
}
