import PaymentResult from '@/components/cms/PaymentResult'

// 결제창·자동결제 등록에서 실패하거나 사용자가 닫았을 때
export default async function PaymentFailPage(
  props: { searchParams: Promise<{ code?: string; message?: string; invoice?: string; billing?: string }> }
) {
  const searchParams = await props.searchParams
  const canceled = searchParams.code === 'PAY_PROCESS_CANCELED' || searchParams.code === 'USER_CANCEL'
  const billing = searchParams.billing === '1'
  const back = billing
    ? [{ href: '/support/billing', label: '결제 정보로', primary: true }]
    : [{ href: searchParams.invoice && /^[0-9a-f-]{36}$/.test(searchParams.invoice) ? `/support/invoices/${searchParams.invoice}` : '/support/invoices', label: '청구서로', primary: true }]
  return (
    <PaymentResult ok={false} title={canceled ? (billing ? '등록을 취소했습니다' : '결제를 취소했습니다') : billing ? '자동결제를 등록하지 못했습니다' : '결제하지 못했습니다'} actions={back}>
      {canceled ? <p>돈은 빠져나가지 않았습니다.</p> : <p>{(searchParams.message ?? '').slice(0, 200) || '잠시 뒤 다시 시도해 주세요.'}</p>}
    </PaymentResult>
  )
}
