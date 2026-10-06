import { getCmsContext } from '@/lib/cms'
import { billingReady, issueBillingKey, paymentDbSecret, TossError } from '@/lib/toss'
import PaymentResult from '@/components/cms/PaymentResult'

export const dynamic = 'force-dynamic'

// 자동결제 등록에서 돌아온 곳: 일회용 인증키로 빌링키를 받아 비공개 표에 저장한다
export default async function BillingSuccessPage(
  props: { searchParams: Promise<{ authKey?: string; customerKey?: string }> }
) {
  const searchParams = await props.searchParams
  const { supabase, outletId, user, isEditorPlus } = await getCmsContext()
  const back = [{ href: '/support/billing', label: '결제 정보로', primary: true }]
  const { authKey, customerKey } = searchParams
  if (!billingReady() || !outletId || !isEditorPlus || !authKey || !customerKey) {
    return <PaymentResult ok={false} title="자동결제를 등록하지 못했습니다" actions={back}>등록 정보를 확인하지 못했습니다. 다시 시도해 주세요.</PaymentResult>
  }
  // 이 매체의 고객 키인지 먼저 확인 (다른 매체 키로 등록되지 않게)
  const { data: mine } = await supabase.rpc('autopay_customer_key', { o: outletId })
  if (mine !== customerKey) {
    return <PaymentResult ok={false} title="다른 매체의 등록 정보입니다" actions={back}>위쪽에서 작업 중인 매체를 확인한 뒤 다시 등록해 주세요.</PaymentResult>
  }
  try {
    const b = await issueBillingKey(authKey, customerKey)
    const transfer = b.transfers?.[0]
    const company = transfer?.bankName ?? b.cardCompany ?? (b.method === '계좌이체' ? '계좌' : '카드')
    const number = transfer?.bankAccountNumber ?? b.cardNumber ?? b.card?.number ?? ''
    const { error } = await supabase.rpc('autopay_save', {
      secret: paymentDbSecret(), o: outletId, p_customer_key: customerKey, p_billing_key: b.billingKey,
      p_card_company: company, p_card_number: number, p_user: user.id, p_provider: 'toss',
    })
    if (error) return <PaymentResult ok={false} title="등록 정보를 저장하지 못했습니다" actions={back}>{error.message}</PaymentResult>
    return (
      <PaymentResult ok title="자동결제를 등록했습니다" actions={back}>
        <p className="font-semibold text-ink">{company} {number}</p>
        <p>앞으로 청구서가 나오면 납부 기한에 이 {b.method === '계좌이체' ? '계좌' : '카드'}로 자동 결제됩니다.</p>
      </PaymentResult>
    )
  } catch (e) {
    const msg = e instanceof TossError ? (e.code === 'NOT_SUPPORTED_METHOD' ? '자동결제 계약이 아직 되지 않았습니다. 운영팀에 문의해 주세요.' : e.message) : '등록하지 못했습니다.'
    return <PaymentResult ok={false} title="자동결제를 등록하지 못했습니다" actions={back}>{msg}</PaymentResult>
  }
}
