import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import BillingForm from '@/components/cms/BillingForm'
import AutopaySection from '@/components/cms/AutopaySection'
import { payProvider } from '@/lib/pay-provider'

export default async function BillingPage() {
  const { supabase, outletId, isEditorPlus } = await getCmsContext()
  if (!isEditorPlus) redirect('/support')
  if (!outletId) {
    return <div className="mx-auto max-w-[800px] px-4 py-10 md:px-8 md:py-16 text-center text-muted">소속 매체가 없는 계정입니다. 관리자에게 소속 지정을 요청하세요.</div>
  }
  const [{ data: billing }, { data: outlet }, { data: autopay }] = await Promise.all([
    supabase.from('outlet_billing').select('*').eq('outlet_id', outletId).maybeSingle(),
    supabase.from('outlets').select('name').eq('id', outletId).single(),
    // payments.sql 실행 전이면 표가 없어 비어 있다
    supabase.from('outlet_autopay').select('card_company, card_number, registered_at, last_error').eq('outlet_id', outletId).eq('active', true).maybeSingle(),
  ])
  return (
    <div className="mx-auto max-w-[800px] px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-[22px] font-extrabold tracking-tight">결제 정보 · {outlet?.name}</h1>
      <p className="mb-6 mt-1 text-[13px] text-muted">청구서·영수증과 결제 안내에 쓰입니다. 편집장 이상만 보고 고칠 수 있습니다.</p>
      <BillingForm outletId={outletId} billing={billing} />
      <AutopaySection autopay={autopay ?? null} ready={payProvider().autopay} provider={payProvider().provider} clientKey={process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? ''} testMode={payProvider().testMode} />
    </div>
  )
}
