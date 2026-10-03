import { createHmac, timingSafeEqual } from 'crypto'

// 미리보기 링크 서명 (서버만 만들 수 있다). 서버에서만 쓴다
export function shareToken(articleId: string) {
  return createHmac('sha256', `share:${process.env.PAYMENT_DB_SECRET ?? ''}`).update(articleId).digest('base64url').slice(0, 22)
}

export function shareTokenOk(articleId: string, token: string | undefined) {
  if (!token || !process.env.PAYMENT_DB_SECRET) return false
  const a = Buffer.from(shareToken(articleId))
  const b = Buffer.from(token)
  return a.length === b.length && timingSafeEqual(a, b)
}
