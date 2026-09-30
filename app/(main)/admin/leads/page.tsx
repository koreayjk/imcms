import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { formatDateTime } from '@/lib/format'
import { PRODUCT } from '@/lib/product'
import LeadCard, { type Lead } from '@/components/cms/LeadCard'

type Props = { searchParams: { tab?: string } }

export default async function LeadsPage({ searchParams }: Props) {
  const { supabase, user, isStaff } = await getCmsContext()
  if (!isStaff) redirect('/newsroom')
  const tab = ['mine', 'open', 'done'].includes(searchParams.tab ?? '') ? searchParams.tab : 'open'

  const [{ data, error }, { data: staffRows }, { data: groups }] = await Promise.all([
    supabase.from('beta_requests').select('*').order('created_at', { ascending: false }).limit(300),
    supabase.from('profiles').select('id, full_name, is_super, is_staff'),
    supabase.from('publishers').select('id, name'),
  ])
  const staff = ((staffRows ?? []) as any[]).filter((p) => p.is_super || p.is_staff).map((p) => ({ id: p.id as string, name: p.full_name as string }))
  const groupName = new Map((groups ?? []).map((g) => [g.id as string, g.name as string]))
  const all = (data ?? []) as Lead[]
  const rows = tab === 'mine' ? all.filter((l) => l.assigned_to === user.id && l.status !== 'done')
    : tab === 'done' ? all.filter((l) => l.status === 'done')
    : all.filter((l) => l.status !== 'done')

  const tabs = [
    { key: 'open', label: '처리할 상담', n: all.filter((l) => l.status !== 'done').length },
    { key: 'mine', label: '내 담당', n: all.filter((l) => l.assigned_to === user.id && l.status !== 'done').length },
    { key: 'done', label: '완료', n: all.filter((l) => l.status === 'done').length },
  ]

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-5 md:px-8 md:py-8">
      <header className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight">고객 상담</h1>
        <p className="mt-1 text-[13px] text-muted">
          {PRODUCT.name} 소개 페이지에서 들어온 신청입니다. 담당 매니저를 정하고 상담 기록을 남긴 뒤, 계약되면 “고객사 개설”로 그룹·매체·발행인을 한 번에 만듭니다. 신청일로부터 1년이 지나면 자동으로 지워집니다.
        </p>
      </header>
      <nav className="mb-4 flex gap-1 text-[14px]">
        {tabs.map((t) => (
          <a key={t.key} href={`/admin/leads?tab=${t.key}`} className={`rounded-full px-3.5 py-1.5 ${tab === t.key ? 'bg-ink font-bold text-white' : 'text-muted hover:text-ink'}`}>
            {t.label} <span className="tabular-nums opacity-70">{t.n}</span>
          </a>
        ))}
      </nav>
      {error ? (
        <p className="rounded-lg border border-draft/40 bg-draft/10 px-5 py-4 text-sm">신청서를 받으려면 Supabase에서 <code>supabase/beta-requests.sql</code>을 실행해 주세요.</p>
      ) : rows.length ? (
        <ul className="space-y-3">
          {rows.map((l) => (
            <LeadCard key={l.id} lead={l} staff={staff} createdLabel={formatDateTime(l.created_at)} groupName={l.publisher_id ? groupName.get(l.publisher_id) ?? null : null} />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-line bg-white px-5 py-16 text-center text-sm text-muted">해당하는 상담이 없습니다.</p>
      )}
    </div>
  )
}
