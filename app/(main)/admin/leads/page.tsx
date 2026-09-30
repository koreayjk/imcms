import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { formatDateTime } from '@/lib/format'
import { PRODUCT } from '@/lib/product'
import PendingButton from '@/components/cms/PendingButton'
import { setLeadStatus } from './actions'

const STATUS_LABEL: Record<string, string> = { new: '새 신청', contacted: '연락함', done: '완료' }
const NEXT: Record<string, { status: string; label: string }> = {
  new: { status: 'contacted', label: '연락함으로' },
  contacted: { status: 'done', label: '완료로' },
  done: { status: 'new', label: '다시 열기' },
}

export default async function LeadsPage() {
  const { supabase, isSuper } = await getCmsContext()
  if (!isSuper) redirect('/newsroom')

  const { data, error } = await supabase.from('beta_requests').select('*').order('created_at', { ascending: false }).limit(200)

  return (
    <div className="mx-auto max-w-[1080px] px-8 py-8">
      <header className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight">고객 상담 신청</h1>
        <p className="mt-1 text-[13px] text-muted">
          {PRODUCT.name} 소개 페이지(<a href={PRODUCT.path} target="_blank" rel="noopener" className="underline underline-offset-2">{PRODUCT.path}</a>)에서 들어온 베타 고객사 신청입니다. 신청일로부터 1년이 지나면 자동으로 지워집니다.
        </p>
      </header>

      {error ? (
        <p className="rounded-lg border border-draft/40 bg-draft/10 px-5 py-4 text-sm">
          신청서를 받으려면 Supabase에서 <code>supabase/beta-requests.sql</code>을 실행해 주세요.
        </p>
      ) : data?.length ? (
        <ul className="space-y-3">
          {data.map((r) => (
            <li key={r.id} className={`rounded-lg border bg-white px-6 py-5 ${r.status === 'new' ? 'border-danger/40' : 'border-line'}`}>
              <div className="flex flex-wrap items-center gap-3">
                <span className={`rounded px-2 py-0.5 text-[12px] font-semibold ${r.status === 'new' ? 'bg-danger text-white' : r.status === 'contacted' ? 'bg-review/10 text-review' : 'bg-line text-muted'}`}>
                  {STATUS_LABEL[r.status] ?? r.status}
                </span>
                <strong className="text-[16px]">{r.company}</strong>
                {r.outlet_count && <span className="text-[13px] text-muted">매체 {r.outlet_count}</span>}
                <time className="ml-auto text-[12.5px] tabular-nums text-muted">{formatDateTime(r.created_at)}</time>
              </div>
              <p className="mt-2 text-[14px]">
                {r.contact_name} · <a href={`tel:${r.phone}`} className="underline underline-offset-2">{r.phone}</a>
                {r.email && <> · <a href={`mailto:${r.email}`} className="underline underline-offset-2">{r.email}</a></>}
                {r.current_cms && <span className="text-muted"> · 사용 중: {r.current_cms}</span>}
              </p>
              {r.message && <p className="mt-2 whitespace-pre-line rounded bg-paper px-4 py-3 text-[13.5px] leading-relaxed">{r.message}</p>}
              <form action={setLeadStatus.bind(null, r.id, NEXT[r.status]?.status ?? 'new')} className="mt-3">
                <PendingButton pending="바꾸는 중…" className="btn-secondary px-3 py-1.5 text-[12.5px]">{NEXT[r.status]?.label ?? '다시 열기'}</PendingButton>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-line bg-white px-5 py-16 text-center text-sm text-muted">아직 들어온 신청이 없습니다.</p>
      )}
    </div>
  )
}
