import { headers } from 'next/headers'
import { PRODUCT } from './product'

// 지금 접속한 주소의 앞부분 (메일 링크·결제 후 돌아올 주소). APP_URL 을 넣으면 그 값을 쓴다
export function siteOrigin() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '')
  const h = headers()
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'imcms.vercel.app'
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

// 편집국 화면 주소 (메일 속 기사·문의·청구서 링크). 편집국 주소(app.imnewsroom.com)를 연 뒤에는 그 주소
export function cmsOrigin() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '')
  return PRODUCT.appLive ? PRODUCT.appUrl : siteOrigin()
}
