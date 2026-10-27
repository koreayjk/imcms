import { createHmac, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto'
import { headers } from 'next/headers'
import { paymentDbSecret } from './toss'

// 비회원(닉네임·비밀번호) 댓글 도우미 (comments.sql 의 comment_add_guest)

// 비밀번호는 salt:hash (scrypt) 로만 저장한다
export function hashGuestPw(pw: string) {
  const salt = randomBytes(12).toString('hex')
  return `${salt}:${scryptSync(pw, salt, 32).toString('hex')}`
}
export function checkGuestPw(pw: string, stored: string | null | undefined) {
  const [salt, hash] = (stored ?? '').split(':')
  if (!salt || !hash) return false
  const got = scryptSync(pw, salt, 32)
  const want = Buffer.from(hash, 'hex')
  return got.length === want.length && timingSafeEqual(got, want)
}

// 접속 주소는 저장하지 않고, 비밀값과 섞어 한쪽으로만 바꾼 값만 쓴다 (도배 막기·차단용)
export async function guestIpHash() {
  const h = await headers()
  const ip = (h.get('x-forwarded-for') ?? '').split(',')[0].trim() || h.get('x-real-ip') || 'unknown'
  return createHmac('sha256', `ip:${paymentDbSecret() || 'dev'}`).update(ip).digest('hex').slice(0, 32)
}

// 그림 문자: 헷갈리는 글자(0 O 1 I)를 뺀 4글자를 살짝 흔들어 SVG 로 그린다
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export function makeCaptcha() {
  let code = ''
  for (let i = 0; i < 4; i++) code += CHARS[randomInt(CHARS.length)]
  const glyphs = [...code].map((ch, i) => {
    const x = 16 + i * 26, y = 30 + randomInt(-3, 4), r = randomInt(-18, 19)
    return `<text x="${x}" y="${y}" font-size="26" font-weight="700" font-family="Arial,sans-serif" fill="#334" transform="rotate(${r} ${x} ${y})">${ch}</text>`
  }).join('')
  const lines = Array.from({ length: 4 }, () => `<line x1="${randomInt(0, 20)}" y1="${randomInt(4, 36)}" x2="${randomInt(100, 124)}" y2="${randomInt(4, 36)}" stroke="#99a" stroke-width="1.2"/>`).join('')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="124" height="40" viewBox="0 0 124 40"><rect width="124" height="40" fill="#f1f3f6"/>${lines}${glyphs}</svg>`
  return { code, image: `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}` }
}
