import { getCmsContext } from '@/lib/cms'
import { recordFailure, recordPayment } from '@/lib/payments'
import { confirmPayment, TossError, tossReady, tossTestMode } from '@/lib/toss'
import { won } from '@/lib/support'
import { formatDateTime } from '@/lib/format'
import PaymentResult from '@/components/cms/PaymentResult'

export const dynamic = 'force-dynamic'

// 결제창에서 돌아온 곳: 주문 금액과 대조한 뒤 토스페이먼츠에 승인을 요청하고 결과를 기록한다
//   새로고침해도 같은 주문번호로 승인을 다시 요청해 같은 결과를 받는다 (중복 결제 없음)
export default async function PaymentSuccessPage({ searchParams }: { searchParams: { paymentKey?: string; orderId?: string; amount?: string } }) {
  const { supabase } = await getCmsContext()
  const { paymentKey, orderId } = searchParams
  const amount = Number(searchParams.amount)
  const back = [{ href: '/support/invoices', label: '청구서 목록' }]

  if (!tossReady() || !paymentKey || !orderId || !Number.isFinite(amount)) {
    return <PaymentResult ok={false} title="결제 정보를 확인하지 못했습니다" actions={back}>청구서에서 다시 결제해 주세요.</PaymentResult>
  }
  const { data: order } = await supabase.rpc('payment_order', { p_order_id: orderId })
  const o = order as { amount: number; status: string; invoiceId: string; orderName: string } | null
  if (!o) return <PaymentResult ok={false} title="주문을 찾지 못했습니다" actions={back}>이 매체의 청구서 결제가 아니거나 권한이 없습니다.</PaymentResult>
  const invoiceLink = { href: `/support/invoices/${o.invoiceId}`, label: '청구서 보기', primary: true }

  // 결제창에서 넘어온 금액이 주문 금액과 다르면 승인하지 않는다
  if (Number(o.amount) !== amount) {
    await recordFailure(supabase, orderId, '결제 금액이 청구 금액과 달라 승인하지 않았습니다.')
    return <PaymentResult ok={false} title="결제 금액이 맞지 않습니다" actions={[invoiceLink]}>청구 금액과 달라 결제를 승인하지 않았습니다. 돈은 빠져나가지 않았습니다.</PaymentResult>
  }

  try {
    const p = await confirmPayment(paymentKey, orderId, amount)
    const { error } = await recordPayment(supabase, p)
    if (p.status !== 'DONE') {
      return <PaymentResult ok={false} title="결제가 끝나지 않았습니다" actions={[invoiceLink]}>결제 상태: {p.status}. 잠시 뒤 청구서에서 다시 확인해 주세요.</PaymentResult>
    }
    return (
      <PaymentResult ok title={tossTestMode() ? '시험 결제가 끝났습니다' : '결제가 끝났습니다'} actions={[invoiceLink, ...back]}>
        <p className="font-semibold text-ink">{o.orderName}</p>
        <p className="tabular-nums">{won(p.totalAmount)} · {p.method ?? ''} · {formatDateTime(p.approvedAt ?? new Date().toISOString())}</p>
        {p.receipt?.url && <p><a href={p.receipt.url} target="_blank" rel="noopener" className="font-semibold text-review underline underline-offset-2">영수증 보기 ↗</a></p>}
        {tossTestMode() && <p className="text-draft">시험 키로 한 결제라 실제 돈은 나가지 않았고, 청구서는 미납 그대로입니다.</p>}
        {error && <p className="text-danger">결제는 됐지만 기록 중 문제가 생겼습니다. 운영팀에 알려 주세요. ({error})</p>}
      </PaymentResult>
    )
  } catch (e) {
    const msg = e instanceof TossError ? e.message : '결제를 승인하지 못했습니다.'
    await recordFailure(supabase, orderId, msg)
    return <PaymentResult ok={false} title="결제를 승인하지 못했습니다" actions={[invoiceLink]}>{msg}</PaymentResult>
  }
}
