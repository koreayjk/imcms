import { headers } from 'next/headers'

// 지금 접속한 주소의 앞부분 (메일 링크·결제 후 돌아올 주소). APP_URL 을 넣으면 그 값을 쓴다
export function siteOrigin() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '')
  const h = headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'imcms.vercel.app'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}
