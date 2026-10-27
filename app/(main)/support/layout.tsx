import Link from 'next/link'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import SupportNav from '@/components/cms/SupportNav'

export default async function SupportLayout({ children }: { children: React.ReactNode }) {
  const { supabase, outletId, isEditorPlus, isStaff } = await getCmsContext()
  const { t } = await getT()
  const canBilling = isStaff || (isEditorPlus && !!outletId)

  const { error: missing } = await supabase.from('support_tickets').select('id', { head: true, count: 'exact' }).limit(1)
  // 편집장인데 청구 담당자가 비어 있으면 알린다 (NDsoft처럼 상단 띠)
  const { data: billing } = !isStaff && canBilling && outletId && !missing
    ? await supabase.from('outlet_billing').select('manager_name, manager_email').eq('outlet_id', outletId).maybeSingle()
    : { data: { manager_name: 'x', manager_email: 'x' } }
  const billingMissing = !billing?.manager_name || !billing?.manager_email

  return (
    <div>
      {billingMissing && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 bg-[#FDECEA] print:hidden px-4 py-2.5 text-[13.5px]">
          <span>{t('청구서·결제 담당자 ', 'The billing contact ')}<strong>{t('정보가 입력되지 않았습니다.', 'information has not been entered.')}</strong></span>
          <Link href="/support/billing" className="shrink-0 whitespace-nowrap rounded-full bg-danger px-3 py-1 text-[12px] font-bold text-white hover:opacity-90">{t('지금 입력하기', 'Enter it now')}</Link>
        </div>
      )}
      <div className="border-b border-line bg-white print:hidden">
        <div className="mx-auto flex max-w-[1180px] items-center gap-4 overflow-x-auto px-4 md:gap-6 md:px-8">
          <p className="shrink-0 py-3.5 text-[15px] font-extrabold tracking-tight">
            {t('고객센터', 'Support')} {isStaff && <span className="ml-1 rounded bg-[#E5483A] px-1.5 py-0.5 align-middle text-[10.5px] font-bold text-white">{t('운영팀', 'Staff')}</span>}
          </p>
          <SupportNav canBilling={canBilling} />
        </div>
      </div>
      {missing ? (
        <div className="mx-auto max-w-[900px] px-4 py-10 md:px-8 md:py-16">
          <p className="rounded-lg border border-draft/40 bg-draft/10 px-5 py-4 text-sm">
            {t('고객센터를 쓰려면 관리자가 Supabase에서 ', 'An administrator must run ')}<code>supabase/support.sql</code>{t('을 실행해야 합니다.', ' in Supabase before Support can be used.')}
          </p>
        </div>
      ) : (
        children
      )}
    </div>
  )
}
