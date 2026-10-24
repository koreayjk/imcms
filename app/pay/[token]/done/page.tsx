import type { Metadata } from 'next'
import type Stripe from 'stripe'
import { invoiceByToken, publicDb } from '@/lib/pay-link'
import { recordStripeIntent } from '@/lib/stripe-record'
import { stripe, stripeMessage, stripeReady, stripeTestMode } from '@/lib/stripe-pay'
import { won } from '@/lib/support'
import { savePayLinkAutopay } from '@/lib/pay-link-autopay'
import PaymentResult from '@/components/cms/PaymentResult'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: '결제 결과 — IM 뉴스룸', robots: { index: false, follow: false }, referrer: 'no-referrer' }

// 결제 전용 링크에서 Stripe 결제 후 돌아온 곳: 결제를 다시 조회해 이 청구서의 주문이고 금액이 맞을 때만 납부 완료로 기록한다 (웹훅도 같은 일을 한다)
export default async function PayLinkDonePage(props: { params: Promise<{ token: string }>; searchParams: Promise<{ session_id?: string }> }) {
  const { token } = await props.params
  const { session_id: sid = '' } = await props.searchParams
  const back = [{ href: `/pay/${token}`, label: '청구서로 돌아가기' }]
  const inv = await invoiceByToken(token)
  if (!inv || !stripeReady() || !/^cs_[A-Za-z0-9_]+$/.test(sid)) {
    return <PaymentResult ok={false} title="결제 정보를 확인하지 못했습니다" actions={back}>결제 링크를 다시 열어 확인해 주세요.</PaymentResult>
  }
  try {
    const session = await stripe().checkout.sessions.retrieve(sid, { expand: ['payment_intent.latest_charge'] })
    if (session.metadata?.invoice_id !== inv.id) return <PaymentResult ok={false} title="이 청구서의 결제가 아닙니다" actions={back}>결제 정보가 맞지 않습니다.</PaymentResult>
    if (session.mode !== 'payment' || !session.payment_intent) {
      return <PaymentResult ok={false} title="결제가 끝나지 않았습니다" actions={back}>결제를 마치지 않았거나 취소했습니다.</PaymentResult>
    }
    const r = await recordStripeIntent(publicDb(), session.payment_intent as string | Stripe.PaymentIntent, { orderId: session.client_reference_id ?? '', amount: Number(inv.total) })
    if (r.status !== 'done') {
      return (
        <PaymentResult ok={false} title={r.status === 'processing' ? '결제를 확인하는 중입니다' : '결제가 끝나지 않았습니다'} actions={back}>
          {r.error ?? (r.status === 'processing' ? '결제사 확인이 끝나면 청구서가 자동으로 “납부 완료”로 바뀝니다. 잠시 뒤 다시 확인해 주세요.' : '잠시 뒤 다시 확인해 주세요.')}
        </PaymentResult>
      )
    }
    // 자동결제에 동의하고 결제한 경우: 이 카드를 매체의 자동결제로 저장한다 (웹훅도 같은 일을 한다)
    const ap = r.pi ? await savePayLinkAutopay(publicDb(), r.pi) : { saved: null, error: null }
    const autopay = ap.saved
    const autopayError = ap.error ?? ''
    return (
      <PaymentResult ok title={stripeTestMode() ? '시험 결제가 끝났습니다' : '결제가 끝났습니다'} actions={back}>
        <p className="font-semibold text-ink">{inv.outlet_name} · {inv.invoice_no ?? '이용료'}</p>
        <p className="tabular-nums">{won(Number(inv.total))}</p>
        {r.charge?.receipt_url && <p><a href={r.charge.receipt_url} target="_blank" rel="noopener" className="font-semibold text-review underline underline-offset-2">영수증 보기 ↗</a></p>}
        {stripeTestMode() && <p className="text-draft">시험 키로 한 결제라 실제 돈은 나가지 않았고, 청구서는 미납 그대로입니다.</p>}
        {autopay && <p className="font-semibold text-published">자동결제가 등록되었습니다 · {autopay.company} {autopay.number}<br /><span className="font-normal text-muted">다음 달부터 청구서가 나오면 납부 기한에 이 카드로 자동 결제됩니다. 해지는 편집국 고객센터 → 결제 정보에서 할 수 있습니다.</span></p>}
        {autopayError && <p className="text-danger">결제는 됐지만 자동결제 등록은 되지 않았습니다. 운영팀에 알려 주세요. ({autopayError})</p>}
        {r.error && <p className="text-danger">결제는 됐지만 기록 중 문제가 생겼습니다. 운영팀에 알려 주세요. ({r.error})</p>}
      </PaymentResult>
    )
  } catch (e) {
    return <PaymentResult ok={false} title="결제를 확인하지 못했습니다" actions={back}>{stripeMessage(e)}</PaymentResult>
  }
}
