import type Stripe from 'stripe'
import { getCmsContext } from '@/lib/cms'
import { paymentDbSecret } from '@/lib/toss'
import { savedLabel, stripe, stripeMessage, stripeReady } from '@/lib/stripe-pay'
import PaymentResult from '@/components/cms/PaymentResult'

export const dynamic = 'force-dynamic'

// Stripe 자동결제 등록에서 돌아온 곳: 저장된 결제수단을 이 매체의 자동결제로 기록한다 (결제수단 ID는 비공개 표에만)
export default async function StripeSetupPage({ searchParams }: { searchParams: { session_id?: string } }) {
  const { supabase, outletId, user, isEditorPlus } = await getCmsContext()
  const back = [{ href: '/support/billing', label: '결제 정보로', primary: true }]
  const sid = searchParams.session_id ?? ''
  if (!stripeReady() || !outletId || !isEditorPlus || !/^cs_[A-Za-z0-9_]+$/.test(sid)) {
    return <PaymentResult ok={false} title="자동결제를 등록하지 못했습니다" actions={back}>등록 정보를 확인하지 못했습니다. 다시 시도해 주세요.</PaymentResult>
  }
  try {
    const session = await stripe().checkout.sessions.retrieve(sid, { expand: ['setup_intent.payment_method'] })
    const { data: mine } = await supabase.rpc('autopay_customer_key', { o: outletId })
    if (session.metadata?.outlet_id !== outletId || session.metadata?.im_customer_key !== mine) {
      return <PaymentResult ok={false} title="다른 매체의 등록 정보입니다" actions={back}>위쪽에서 작업 중인 매체를 확인한 뒤 다시 등록해 주세요.</PaymentResult>
    }
    const si = session.setup_intent as Stripe.SetupIntent | null
    const pm = si?.payment_method as Stripe.PaymentMethod | null
    const customer = typeof session.customer === 'string' ? session.customer : session.customer?.id
    if (si?.status !== 'succeeded' || !pm || !customer) {
      return <PaymentResult ok={false} title="등록이 끝나지 않았습니다" actions={back}>결제수단 저장을 마치지 않았습니다. 다시 시도해 주세요.</PaymentResult>
    }
    const label = savedLabel(pm)
    const { error } = await supabase.rpc('autopay_save', {
      secret: paymentDbSecret(), o: outletId, p_customer_key: mine, p_billing_key: `${customer}|${pm.id}`,
      p_card_company: label.company, p_card_number: label.number, p_user: user.id, p_provider: 'stripe',
    })
    if (error) return <PaymentResult ok={false} title="등록 정보를 저장하지 못했습니다" actions={back}>{error.message}</PaymentResult>
    return (
      <PaymentResult ok title="자동결제를 등록했습니다" actions={back}>
        <p className="font-semibold text-ink">{label.company} {label.number}</p>
        <p>앞으로 청구서가 나오면 납부 기한 오전 10시에 자동으로 결제됩니다.</p>
      </PaymentResult>
    )
  } catch (e) {
    return <PaymentResult ok={false} title="자동결제를 등록하지 못했습니다" actions={back}>{stripeMessage(e)}</PaymentResult>
  }
}
