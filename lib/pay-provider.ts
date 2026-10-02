import { stripeReady, stripeTestMode } from './stripe-pay'
import { billingReady, tossReady, tossTestMode } from './toss'

// 쓰는 결제사: Stripe 키가 있으면 Stripe(미국 법인), 없고 토스 키가 있으면 토스페이먼츠
export function payProvider(): { provider: 'stripe' | 'toss' | null; testMode: boolean; autopay: boolean } {
  if (stripeReady()) return { provider: 'stripe', testMode: stripeTestMode(), autopay: true }
  if (tossReady()) return { provider: 'toss', testMode: tossTestMode(), autopay: billingReady() }
  return { provider: null, testMode: false, autopay: false }
}
