import type Stripe from 'stripe'
import { getCmsContext } from '@/lib/cms'
import { recordStripeIntent } from '@/lib/stripe-record'
import { stripe, stripeMessage, stripeReady, stripeTestMode } from '@/lib/stripe-pay'
import { won } from '@/lib/support'
import PaymentResult from '@/components/cms/PaymentResult'

export const dynamic = 'force-dynamic'

// Stripe 결제 페이지에서 돌아온 곳: 결제를 다시 조회하고 우리 주문(금액)과 맞으면 청구서를 납부 완료로 바꾼다
//   새로고침해도 같은 결제를 다시 기록할 뿐이다 (중복 결제 없음). 웹훅도 같은 일을 한다
export default async function StripeSuccessPage({ searchParams }: { searchParams: { session_id?: string } }) {
  const { supabase } = await getCmsContext()
  const back = [{ href: '/support/invoices', label: '청구서 목록' }]
  const sid = searchParams.session_id ?? ''
  if (!stripeReady() || !/^cs_[A-Za-z0-9_]+$/.test(sid)) {
    return <PaymentResult ok={false} title="결제 정보를 확인하지 못했습니다" actions={back}>청구서에서 다시 결제해 주세요.</PaymentResult>
  }
  try {
    const session = await stripe().checkout.sessions.retrieve(sid, { expand: ['payment_intent.latest_charge'] })
    const orderId = session.client_reference_id ?? ''
    const { data: order } = await supabase.rpc('payment_order', { p_order_id: orderId })
    const o = order as { amount: number; invoiceId: string; orderName: string } | null
    if (!o) return <PaymentResult ok={false} title="주문을 찾지 못했습니다" actions={back}>이 매체의 청구서 결제가 아니거나 권한이 없습니다.</PaymentResult>
    const invoiceLink = { href: `/support/invoices/${o.invoiceId}`, label: '청구서 보기', primary: true }
    if (session.mode !== 'payment' || !session.payment_intent) {
      return <PaymentResult ok={false} title="결제가 끝나지 않았습니다" actions={[invoiceLink]}>결제를 마치지 않았거나 취소했습니다.</PaymentResult>
    }
    const r = await recordStripeIntent(supabase, session.payment_intent as string | Stripe.PaymentIntent, { orderId, amount: Number(o.amount) })
    if (r.status !== 'done') {
      return (
        <PaymentResult ok={false} title={r.status === 'processing' ? '결제를 확인하는 중입니다' : '결제가 끝나지 않았습니다'} actions={[invoiceLink]}>
          {r.error ?? (r.status === 'processing' ? '결제사 확인이 끝나면 청구서가 자동으로 “납부 완료”로 바뀝니다.' : '잠시 뒤 청구서에서 다시 확인해 주세요.')}
        </PaymentResult>
      )
    }
    return (
      <PaymentResult ok title={stripeTestMode() ? '시험 결제가 끝났습니다' : '결제가 끝났습니다'} actions={[invoiceLink, ...back]}>
        <p className="font-semibold text-ink">{o.orderName}</p>
        <p className="tabular-nums">{won(Number(o.amount))}</p>
        {r.charge?.receipt_url && <p><a href={r.charge.receipt_url} target="_blank" rel="noopener" className="font-semibold text-review underline underline-offset-2">영수증 보기 ↗</a></p>}
        {stripeTestMode() && <p className="text-draft">시험 키로 한 결제라 실제 돈은 나가지 않았고, 청구서는 미납 그대로입니다.</p>}
        {r.error && <p className="text-danger">결제는 됐지만 기록 중 문제가 생겼습니다. 운영팀에 알려 주세요. ({r.error})</p>}
      </PaymentResult>
    )
  } catch (e) {
    return <PaymentResult ok={false} title="결제를 확인하지 못했습니다" actions={back}>{stripeMessage(e)}</PaymentResult>
  }
}
