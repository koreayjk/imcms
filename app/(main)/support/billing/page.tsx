import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import BillingForm from '@/components/cms/BillingForm'

export default async function BillingPage() {
  const { supabase, outletId, isEditorPlus } = await getCmsContext()
  if (!isEditorPlus) redirect('/support')
  if (!outletId) {
    return <div className="mx-auto max-w-[800px] px-4 py-10 md:px-8 md:py-16 text-center text-muted">소속 매체가 없는 계정입니다. 관리자에게 소속 지정을 요청하세요.</div>
  }
  const [{ data: billing }, { data: outlet }] = await Promise.all([
    supabase.from('outlet_billing').select('*').eq('outlet_id', outletId).maybeSingle(),
    supabase.from('outlets').select('name').eq('id', outletId).single(),
  ])
  return (
    <div className="mx-auto max-w-[800px] px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-[22px] font-extrabold tracking-tight">결제 정보 · {outlet?.name}</h1>
      <p className="mb-6 mt-1 text-[13px] text-muted">청구서와 세금계산서에 쓰입니다. 편집장 이상만 보고 고칠 수 있습니다.</p>
      <BillingForm outletId={outletId} billing={billing} />
    </div>
  )
}
