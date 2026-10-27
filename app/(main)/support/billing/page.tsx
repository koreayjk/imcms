import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import BillingForm from '@/components/cms/BillingForm'
import AutopaySection from '@/components/cms/AutopaySection'
import { payProvider } from '@/lib/pay-provider'

export default async function BillingPage() {
  const { supabase, outletId, isEditorPlus } = await getCmsContext()
  const { t, lang } = await getT()
  if (!isEditorPlus) redirect('/support')
  if (!outletId) {
    return <div className="mx-auto max-w-[800px] px-4 py-10 md:px-8 md:py-16 text-center text-muted">{t('소속 매체가 없는 계정입니다. 관리자에게 소속 지정을 요청하세요.', 'This account is not assigned to a publication. Ask an administrator to assign one.')}</div>
  }
  const [{ data: billing }, { data: outlet }, { data: autopay }] = await Promise.all([
    supabase.from('outlet_billing').select('*').eq('outlet_id', outletId).maybeSingle(),
    supabase.from('outlets').select('name, site').eq('id', outletId).single(),
    // payments.sql 실행 전이면 표가 없어 비어 있다
    supabase.from('outlet_autopay').select('card_company, card_number, registered_at, last_error').eq('outlet_id', outletId).eq('active', true).maybeSingle(),
  ])
  // 아직 적지 않은 칸은 홈페이지 설정의 “하단 표시 정보”로 미리 채워 둔다 (확인하고 저장하면 된다)
  const legal = ((outlet as { site?: { legal?: Record<string, string | undefined> } } | null)?.site?.legal ?? {}) as Record<string, string | undefined>
  const pick = (a: string | null | undefined, b: string | undefined) => (a && a.trim() ? a : b?.trim() || null)
  const prefilled = {
    company_name: pick(billing?.company_name, legal.company),
    biz_no: pick(billing?.biz_no, legal.bizNo),
    ceo_name: pick(billing?.ceo_name, legal.ceo || legal.publisher),
    address: pick(billing?.address, [legal.postcode, legal.address].filter(Boolean).join(' ')),
    manager_name: pick(billing?.manager_name, legal.ceo || legal.publisher),
    manager_email: pick(billing?.manager_email, legal.email),
    manager_phone: pick(billing?.manager_phone, legal.phone),
  }
  return (
    <div className="mx-auto max-w-[800px] px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-[22px] font-extrabold tracking-tight">{t('결제 정보', 'Billing info')} · {outlet?.name}</h1>
      <p className="mb-6 mt-1 text-[13px] text-muted">{t('청구서·영수증과 결제 안내에 쓰입니다. 편집장 이상만 보고 고칠 수 있습니다.', 'Used on invoices, receipts and payment notices. Only Editors-in-Chief and above can view and edit this.')}</p>
      {(!billing?.manager_name || !billing?.manager_email) && (prefilled.manager_name || prefilled.manager_email) && (
        <p className="mb-5 rounded-lg border border-review/30 bg-review/5 px-4 py-3 text-[13px] leading-relaxed">
          {lang === 'en'
            ? <>Not saved yet. The fields below are <strong>pre-filled</strong> from the footer information in Settings. Review them and press <strong>Save</strong> at the bottom to use them on invoices; the red notice at the top will then disappear.</>
            : <>아직 저장되지 않았습니다. 아래 칸은 설정의 “하단 표시 정보”로 <strong>미리 채워 둔 것</strong>입니다. 내용을 확인하고 맨 아래 <strong>저장</strong>을 눌러야 청구서에 쓰이고, 위쪽 빨간 안내도 사라집니다.</>}
        </p>
      )}
      <BillingForm outletId={outletId} billing={prefilled} />
      <AutopaySection autopay={autopay ?? null} ready={payProvider().autopay} provider={payProvider().provider} clientKey={process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY ?? ''} testMode={payProvider().testMode} />
    </div>
  )
}
