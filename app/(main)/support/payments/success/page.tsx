import { getCmsContext } from '@/lib/cms'
import { recordFailure, recordPayment } from '@/lib/payments'
import { confirmPayment, TossError, tossReady, tossTestMode } from '@/lib/toss'
import { wonL } from '@/lib/support-i18n'
import { formatDateTime } from '@/lib/format'
import PaymentResult from '@/components/cms/PaymentResult'
import { getT } from '@/lib/cms-t'

export const dynamic = 'force-dynamic'

// 결제창에서 돌아온 곳: 주문 금액과 대조한 뒤 토스페이먼츠에 승인을 요청하고 결과를 기록한다
//   새로고침해도 같은 주문번호로 승인을 다시 요청해 같은 결과를 받는다 (중복 결제 없음)
export default async function PaymentSuccessPage(
  props: { searchParams: Promise<{ paymentKey?: string; orderId?: string; amount?: string }> }
) {
  const searchParams = await props.searchParams
  const { supabase } = await getCmsContext()
  const { t, lang } = await getT()
  const { paymentKey, orderId } = searchParams
  const amount = Number(searchParams.amount)
  const back = [{ href: '/support/invoices', label: t('청구서 목록', 'Invoices') }]

  if (!tossReady() || !paymentKey || !orderId || !Number.isFinite(amount)) {
    return <PaymentResult ok={false} title={t('결제 정보를 확인하지 못했습니다', 'Could not verify the payment details')} actions={back}>{t('청구서에서 다시 결제해 주세요.', 'Please pay again from the invoice.')}</PaymentResult>
  }
  const { data: order } = await supabase.rpc('payment_order', { p_order_id: orderId })
  const o = order as { amount: number; status: string; invoiceId: string; orderName: string } | null
  if (!o) return <PaymentResult ok={false} title={t('주문을 찾지 못했습니다', 'Order not found')} actions={back}>{t('이 매체의 청구서 결제가 아니거나 권한이 없습니다.', 'This is not a payment for this publication\'s invoice, or you do not have permission.')}</PaymentResult>
  const invoiceLink = { href: `/support/invoices/${o.invoiceId}`, label: t('청구서 보기', 'View invoice'), primary: true }

  // 이미 끝났거나(새로 고침·뒤로 가기) 무효가 된 주문(청구서 금액이 바뀜)은 승인하지 않는다 → 돈이 빠져나가지 않는다
  if (o.status === 'done') return <PaymentResult ok title={t('이미 결제가 끝난 주문입니다', 'This order has already been paid')} actions={[invoiceLink, ...back]}>{t('청구서에서 결제 내역과 영수증을 볼 수 있습니다.', 'You can see the payment details and receipt on the invoice.')}</PaymentResult>
  if (o.status !== 'ready') return <PaymentResult ok={false} title={t('이 결제는 진행할 수 없습니다', 'This payment cannot proceed')} actions={[invoiceLink]}>{t('청구서 금액이 바뀌었거나 이미 끝난 주문입니다. 청구서에서 다시 결제해 주세요. 돈은 빠져나가지 않았습니다.', 'The invoice amount changed or the order is already finished. Please pay again from the invoice. No money was charged.')}</PaymentResult>

  // 결제창에서 넘어온 금액이 주문 금액과 다르면 승인하지 않는다
  if (Number(o.amount) !== amount) {
    await recordFailure(supabase, orderId, '결제 금액이 청구 금액과 달라 승인하지 않았습니다.')
    return <PaymentResult ok={false} title={t('결제 금액이 맞지 않습니다', 'The payment amount does not match')} actions={[invoiceLink]}>{t('청구 금액과 달라 결제를 승인하지 않았습니다. 돈은 빠져나가지 않았습니다.', 'The payment was not approved because it differs from the invoice amount. No money was charged.')}</PaymentResult>
  }

  try {
    const p = await confirmPayment(paymentKey, orderId, amount)
    const { error } = await recordPayment(supabase, p)
    if (p.status !== 'DONE') {
      return <PaymentResult ok={false} title={t('결제가 끝나지 않았습니다', 'Payment is not complete')} actions={[invoiceLink]}>{t('결제 상태', 'Payment status')}: {p.status}. {t('잠시 뒤 청구서에서 다시 확인해 주세요.', 'Please check the invoice again in a moment.')}</PaymentResult>
    }
    return (
      <PaymentResult ok title={tossTestMode() ? t('시험 결제가 끝났습니다', 'Test payment complete') : t('결제가 끝났습니다', 'Payment complete')} actions={[invoiceLink, ...back]}>
        <p className="font-semibold text-ink">{o.orderName}</p>
        <p className="tabular-nums">{wonL(p.totalAmount, lang)} · {p.method ?? ''} · {formatDateTime(p.approvedAt ?? new Date().toISOString(), lang)}</p>
        {p.receipt?.url && <p><a href={p.receipt.url} target="_blank" rel="noopener" className="font-semibold text-review underline underline-offset-2">{t('영수증 보기 ↗', 'View receipt ↗')}</a></p>}
        {tossTestMode() && <p className="text-draft">{t('시험 키로 한 결제라 실제 돈은 나가지 않았고, 청구서는 미납 그대로입니다.', 'This was paid with a test key, so no real money was charged and the invoice stays unpaid.')}</p>}
        {error && <p className="text-danger">{t('결제는 됐지만 기록 중 문제가 생겼습니다. 운영팀에 알려 주세요.', 'The payment went through, but there was a problem recording it. Please tell the IM Newsroom team.')} ({error})</p>}
      </PaymentResult>
    )
  } catch (e) {
    // DB 기록은 한국어 그대로, 화면 문구만 화면 언어로
    await recordFailure(supabase, orderId, e instanceof TossError ? e.message : '결제를 승인하지 못했습니다.')
    const msg = e instanceof TossError ? e.message : t('결제를 승인하지 못했습니다.', 'Could not approve the payment.')
    return <PaymentResult ok={false} title={t('결제를 승인하지 못했습니다', 'Could not approve the payment')} actions={[invoiceLink]}>{msg}</PaymentResult>
  }
}
