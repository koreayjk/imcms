import PaymentResult from '@/components/cms/PaymentResult'
import { getT } from '@/lib/cms-t'

// 결제창·자동결제 등록에서 실패하거나 사용자가 닫았을 때
export default async function PaymentFailPage(
  props: { searchParams: Promise<{ code?: string; message?: string; invoice?: string; billing?: string }> }
) {
  const searchParams = await props.searchParams
  const { t } = await getT()
  const canceled = searchParams.code === 'PAY_PROCESS_CANCELED' || searchParams.code === 'USER_CANCEL'
  const billing = searchParams.billing === '1'
  const back = billing
    ? [{ href: '/support/billing', label: t('결제 정보로', 'Back to billing info'), primary: true }]
    : [{ href: searchParams.invoice && /^[0-9a-f-]{36}$/.test(searchParams.invoice) ? `/support/invoices/${searchParams.invoice}` : '/support/invoices', label: t('청구서로', 'Back to invoices'), primary: true }]
  return (
    <PaymentResult ok={false} title={canceled ? (billing ? t('등록을 취소했습니다', 'Registration canceled') : t('결제를 취소했습니다', 'Payment canceled')) : billing ? t('자동결제를 등록하지 못했습니다', 'Could not register autopay') : t('결제하지 못했습니다', 'Payment failed')} actions={back}>
      {canceled ? <p>{t('돈은 빠져나가지 않았습니다.', 'No money was charged.')}</p> : <p>{(searchParams.message ?? '').slice(0, 200) || t('잠시 뒤 다시 시도해 주세요.', 'Please try again in a moment.')}</p>}
    </PaymentResult>
  )
}
