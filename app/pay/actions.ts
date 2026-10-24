'use server'

import { createPayLinkCheckout } from '@/lib/pay-link-checkout'
import { paymentDbSecret } from '@/lib/toss'
import { isPayToken, publicDb } from '@/lib/pay-link'

// 결제 전용 링크 화면의 결제 버튼 (로그인 없음). 자동결제 카드로 저장되는 매체는 동의에 체크해야 결제할 수 있다
export async function startPayLinkCheckout(token: string, consent = false): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  if (!isPayToken(token)) return { ok: false, error: '결제 링크가 올바르지 않습니다.' }
  const { data: pre } = await publicDb().rpc('invoice_by_pay_token', { secret: paymentDbSecret(), p_token: token })
  if (!(pre as { has_autopay?: boolean } | null)?.has_autopay && !consent) return { ok: false, error: '자동결제 동의에 체크해 주세요. 이번 결제 카드가 다음 달부터 자동결제로 등록됩니다.' }
  return createPayLinkCheckout(token)
}
