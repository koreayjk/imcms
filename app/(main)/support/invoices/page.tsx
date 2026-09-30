import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { monthLabel, won } from '@/lib/support'

export default async function InvoicesPage() {
  const { supabase, isSuper, isEditorPlus } = await getCmsContext()
  if (!isEditorPlus) redirect('/support')
  const isStaff = isSuper
  const { data } = await supabase.from('invoices').select('id, month, total, status, due_date, outlet:outlets(name)').order('month', { ascending: false }).limit(120)

  return (
    <div className="mx-auto max-w-[1000px] px-8 py-10">
      <div className="flex items-center justify-between border-b-2 border-ink pb-4">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">청구서</h1>
          <p className="mt-0.5 text-[12.5px] text-muted">{isStaff ? '모든 회원사의 청구서입니다.' : '우리 매체의 월별 청구서입니다. 편집장 이상만 볼 수 있습니다.'}</p>
        </div>
        {isStaff && <Link href="/support/invoices/new" className="rounded-full bg-[#2F6BF0] px-5 py-2 text-[14px] font-bold text-white hover:opacity-90">+ 청구서 발행</Link>}
      </div>
      <ul className="divide-y divide-line">
        {(data ?? []).map((i: any) => (
          <li key={i.id}>
            <Link href={`/support/invoices/${i.id}`} className="flex items-center gap-4 px-2 py-4 hover:bg-white">
              <span className="w-28 font-bold">{monthLabel(i.month)}</span>
              {isStaff && <span className="w-40 truncate text-[13.5px] text-muted">{i.outlet?.name}</span>}
              <span className="flex-1 text-right text-[16px] font-bold tabular-nums">{won(i.total)}</span>
              <span className={`w-20 rounded px-2 py-1 text-center text-[12px] font-semibold ${i.status === 'paid' ? 'bg-published/10 text-published' : 'bg-danger/10 text-danger'}`}>{i.status === 'paid' ? '납부 완료' : '미납'}</span>
              <span className="text-muted">›</span>
            </Link>
          </li>
        ))}
        {!data?.length && <li className="py-16 text-center text-muted">발행된 청구서가 없습니다.</li>}
      </ul>
    </div>
  )
}
