import type Stripe from 'stripe'
import { getCmsContext } from '@/lib/cms'
import { paymentDbSecret } from '@/lib/toss'
import { savedLabel, stripe, stripeMessage, stripeReady } from '@/lib/stripe-pay'
import PaymentResult from '@/components/cms/PaymentResult'
import { getT } from '@/lib/cms-t'

export const dynamic = 'force-dynamic'

// Stripe 자동결제 등록에서 돌아온 곳: 저장된 결제수단을 이 매체의 자동결제로 기록한다 (결제수단 ID는 비공개 표에만)
export default async function StripeSetupPage(props: { searchParams: Promise<{ session_id?: string }> }) {
  const searchParams = await props.searchParams
  const { supabase, outletId, user, isEditorPlus } = await getCmsContext()
  const { t } = await getT()
  const back = [{ href: '/support/billing', label: t('결제 정보로', 'Back to billing info'), primary: true }]
  const sid = searchParams.session_id ?? ''
  if (!stripeReady() || !outletId || !isEditorPlus || !/^cs_[A-Za-z0-9_]+$/.test(sid)) {
    return <PaymentResult ok={false} title={t('자동결제를 등록하지 못했습니다', 'Could not register autopay')} actions={back}>{t('등록 정보를 확인하지 못했습니다. 다시 시도해 주세요.', 'Could not verify the registration details. Please try again.')}</PaymentResult>
  }
  try {
    const session = await stripe().checkout.sessions.retrieve(sid, { expand: ['setup_intent.payment_method'] })
    const { data: mine } = await supabase.rpc('autopay_customer_key', { o: outletId })
    if (session.metadata?.outlet_id !== outletId || session.metadata?.im_customer_key !== mine) {
      return <PaymentResult ok={false} title={t('다른 매체의 등록 정보입니다', 'This registration belongs to another publication')} actions={back}>{t('위쪽에서 작업 중인 매체를 확인한 뒤 다시 등록해 주세요.', 'Check which publication you are working on at the top, then register again.')}</PaymentResult>
    }
    const si = session.setup_intent as Stripe.SetupIntent | null
    const pm = si?.payment_method as Stripe.PaymentMethod | null
    const customer = typeof session.customer === 'string' ? session.customer : session.customer?.id
    if (si?.status !== 'succeeded' || !pm || !customer) {
      return <PaymentResult ok={false} title={t('등록이 끝나지 않았습니다', 'Registration is not complete')} actions={back}>{t('결제수단 저장을 마치지 않았습니다. 다시 시도해 주세요.', 'The payment method was not saved. Please try again.')}</PaymentResult>
    }
    const label = savedLabel(pm)
    const { error } = await supabase.rpc('autopay_save', {
      secret: paymentDbSecret(), o: outletId, p_customer_key: mine, p_billing_key: `${customer}|${pm.id}`,
      p_card_company: label.company, p_card_number: label.number, p_user: user.id, p_provider: 'stripe',
    })
    if (error) return <PaymentResult ok={false} title={t('등록 정보를 저장하지 못했습니다', 'Could not save the registration')} actions={back}>{error.message}</PaymentResult>
    return (
      <PaymentResult ok title={t('자동결제를 등록했습니다', 'Autopay registered')} actions={back}>
        <p className="font-semibold text-ink">{label.company} {label.number}</p>
        <p>{t('앞으로 청구서가 나오면 납부 기한 오전 10시에 자동으로 결제됩니다.', 'From now on, invoices will be charged automatically at 10 a.m. on the due date.')}</p>
      </PaymentResult>
    )
  } catch (e) {
    return <PaymentResult ok={false} title={t('자동결제를 등록하지 못했습니다', 'Could not register autopay')} actions={back}>{stripeMessage(e)}</PaymentResult>
  }
}
