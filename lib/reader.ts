import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { paymentDbSecret } from './toss'

// 홈페이지 독자 로그인 (댓글용). 독자 계정은 편집국 회원(profiles)과 별개다 — readers 표 (comments.sql)
//   로그인 상태는 서명한 쿠키(im_reader)에 독자 번호를 담아 기억한다. 구글·이메일 확인 링크는 짧게 쓰는 서명 토큰으로 오간다
export const READER_COOKIE = 'im_reader'
const COOKIE_DAYS = 90

const secretKey = () => `reader:${paymentDbSecret() || 'dev'}`
const b64 = (s: string) => Buffer.from(s).toString('base64url')
const unb64 = (s: string) => Buffer.from(s, 'base64url').toString('utf8')
const mac = (payload: string) => createHmac('sha256', secretKey()).update(payload).digest('base64url')

// 서명한 토큰: kind 와 값, 만료 시각(초)을 담는다
export function signToken(kind: string, data: Record<string, string>, ttlSec: number) {
  const payload = b64(JSON.stringify({ k: kind, d: data, e: Math.floor(Date.now() / 1000) + ttlSec }))
  return `${payload}.${mac(payload)}`
}
export function readToken(kind: string, token: string | null | undefined): Record<string, string> | null {
  if (!token) return null
  const [payload, sig] = token.split('.')
  if (!payload || !sig) return null
  const want = mac(payload)
  if (sig.length !== want.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null
  try {
    const o = JSON.parse(unb64(payload)) as { k: string; d: Record<string, string>; e: number }
    return o.k === kind && o.e > Date.now() / 1000 ? o.d : null
  } catch { return null }
}

export const anonClient = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })

export async function setReaderCookie(readerId: string) {
  ;(await cookies()).set(READER_COOKIE, signToken('reader', { id: readerId }, COOKIE_DAYS * 86400), { path: '/', httpOnly: true, sameSite: 'lax', secure: true, maxAge: COOKIE_DAYS * 86400 })
}
export async function clearReaderCookie() {
  ;(await cookies()).delete(READER_COOKIE)
}

// 지금 로그인한 독자 (차단됐거나 없으면 null)
export async function getReader(): Promise<{ id: string; name: string } | null> {
  const d = readToken('reader', (await cookies()).get(READER_COOKIE)?.value)
  if (!d?.id) return null
  const { data } = await anonClient().rpc('reader_get', { secret: paymentDbSecret(), rid: d.id })
  return typeof data === 'string' ? { id: d.id, name: data } : null
}

// 로그인 뒤 돌아갈 곳은 같은 사이트 안의 경로만 (열린 리다이렉트 방지)
export const safeNext = (v: string | null | undefined) => (v && /^\/[^/\\]/.test(v) ? v : '/')

export const googleReady = () => !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET
