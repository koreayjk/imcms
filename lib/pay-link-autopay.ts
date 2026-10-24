import type Stripe from 'stripe'
import type { SupabaseClient } from '@supabase/supabase-js'
import { savedLabel, stripe, stripeTestMode } from './stripe-pay'
import { paymentDbSecret } from './toss'
import { AUTOPAY_CONSENT_VERSION } from './autopay-consent'

// 결제 전용 링크에서 자동결제에 동의하고 결제한 건: 결제가 끝나면 그 카드를 매체의 자동결제로 저장한다
//   결제 완료 화면과 웹훅이 같이 부른다 (화면을 닫아도 웹훅이 저장한다). 여러 번 불러도 같은 카드를 다시 저장할 뿐이다. 시험 키 결제는 저장하지 않는다
export async function savePayLinkAutopay(supabase: SupabaseClient, pi: Stripe.PaymentIntent): Promise<{ saved: { company: string; number: string } | null; error: string | null }> {
  if (pi.metadata?.autopay !== '1' || pi.status !== 'succeeded' || stripeTestMode()) return { saved: null, error: null }
  const invoiceId = pi.metadata.invoice_id
  const customer = typeof pi.customer === 'string' ? pi.customer : pi.customer?.id
  const pmId = typeof pi.payment_method === 'string' ? pi.payment_method : pi.payment_method?.id
  if (!invoiceId || !customer || !pmId || !pi.metadata.im_customer_key) return { saved: null, error: '저장할 카드 정보를 찾지 못했습니다.' }
  try {
    const label = savedLabel(await stripe().paymentMethods.retrieve(pmId))
    const { error } = await supabase.rpc('payment_link_autopay_save', {
      secret: paymentDbSecret(), p_invoice: invoiceId, p_customer_key: pi.metadata.im_customer_key,
      p_billing_key: `${customer}|${pmId}`, p_card_company: label.company, p_card_number: label.number, p_version: AUTOPAY_CONSENT_VERSION,
    })
    return error ? { saved: null, error: error.message } : { saved: label, error: null }
  } catch (e) {
    return { saved: null, error: e instanceof Error ? e.message : '자동결제를 저장하지 못했습니다.' }
  }
}
