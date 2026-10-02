import Stripe from 'stripe'
export { siteOrigin } from './origin'

// Stripe 결제 (미국 법인 계정). 한국 카드·카카오페이·네이버페이·구글페이 등은 Stripe 대시보드 → 결제수단에서 켠다
//   환경 변수: STRIPE_SECRET_KEY(서버), STRIPE_WEBHOOK_SECRET(웹훅 서명), PAYMENT_DB_SECRET(결제 기록용 DB 열쇠, payments.sql 결과)
//   결제수단 종류는 코드에 적지 않는다(대시보드 설정을 따른다) — 이 SDK 버전은 payment_method_types 를 받지 않는다
let client: Stripe | null = null
export function stripe() {
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY as string, { maxNetworkRetries: 2, timeout: 60_000 })
  return client
}
export const stripeReady = () => !!(process.env.STRIPE_SECRET_KEY && process.env.PAYMENT_DB_SECRET)
export const stripeTestMode = () => /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY ?? '')

const PM_LABEL: Record<string, string> = {
  card: '카드', kr_card: '국내 카드', kakao_pay: '카카오페이', naver_pay: '네이버페이', samsung_pay: '삼성페이', payco: '페이코',
  link: 'Link', apple_pay: '애플페이', google_pay: '구글페이',
}

// 결제 수단 이름 (화면·기록용)
export function methodLabel(details: Stripe.Charge.PaymentMethodDetails | null | undefined) {
  if (!details) return null
  const wallet = details.card?.wallet?.type
  if (wallet) return PM_LABEL[wallet] ?? wallet
  return PM_LABEL[details.type] ?? details.type
}

// 저장한 결제수단 표시 (예: “Visa •••• 4242”, “카카오페이”)
export function savedLabel(pm: Stripe.PaymentMethod) {
  if (pm.card) return { company: pm.card.brand ? pm.card.brand.toUpperCase() : '카드', number: pm.card.last4 ? `•••• ${pm.card.last4}` : '' }
  return { company: PM_LABEL[pm.type] ?? pm.type, number: '' }
}

export function stripeMessage(e: unknown) {
  if (e instanceof Stripe.errors.StripeCardError) return e.message || '카드사에서 결제를 거절했습니다.'
  if (e instanceof Stripe.errors.StripeError) return e.message || '결제 서버 오류가 났습니다.'
  return '결제 서버에 연결하지 못했습니다.'
}
