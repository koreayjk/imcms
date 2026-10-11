import type { User } from '@supabase/supabase-js'

// 편집국 화면을 열 때마다 로그인 확인(Supabase 인증 서버 왕복)을 두 번 하지 않도록,
//   proxy가 확인한 회원 정보를 서버 열쇠로 서명해 같은 요청의 화면(getCmsContext)에 넘긴다
//   · 바깥에서 보낸 같은 이름의 헤더는 proxy가 먼저 지운다
//   · 서명·만료(1분)·로그인 쿠키의 회원 번호가 모두 맞을 때만 쓰고, 아니면 예전처럼 인증 서버에 다시 묻는다
export const VERIFIED_USER_HEADER = 'x-im-verified-user'

const enc = new TextEncoder()

function secret() {
  const s = process.env.PAYMENT_DB_SECRET
  return s ? `verified-user:${s}` : null
}

async function hmac(key: string, data: string) {
  const k = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(data)))
  return b64url(sig)
}

function b64url(bytes: Uint8Array) {
  let s = ''
  bytes.forEach((b) => { s += String.fromCharCode(b) })
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
}

export async function signVerifiedUser(user: User): Promise<string | null> {
  const key = secret()
  if (!key) return null
  // 로그인 수단 목록(identities)은 화면에서 쓰지 않고 길어서 뺀다
  const { identities: _identities, ...rest } = user
  void _identities
  const body = b64url(enc.encode(JSON.stringify({ u: rest, exp: Date.now() + 60_000 })))
  return `${body}.${await hmac(key, body)}`
}

export async function readVerifiedUser(value: string | null | undefined, expectSub: string | undefined): Promise<User | null> {
  const key = secret()
  if (!key || !value || !expectSub) return null
  const [body, sig] = value.split('.')
  if (!body || !sig) return null
  const want = await hmac(key, body)
  let diff = want.length ^ sig.length
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ (sig.charCodeAt(i) || 0)
  if (diff !== 0) return null
  try {
    const { u, exp } = JSON.parse(fromB64url(body)) as { u: User; exp: number }
    if (!u?.id || typeof exp !== 'number' || exp < Date.now() || u.id !== expectSub) return null
    return u
  } catch {
    return null
  }
}
