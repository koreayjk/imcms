import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import GroupOutlets from '@/components/cms/GroupOutlets'

export default async function OutletsPage() {
  const { supabase, isSuper, isGroupAdmin, publisherId, outletId } = await getCmsContext()
  if (!isGroupAdmin) redirect('/articles')

  const [{ data: groups, error }, { data: outlets }, { data: members }] = await Promise.all([
    supabase.from('publishers').select('id, name').order('created_at'),
    supabase.from('outlets').select('id, name, domain, publisher_id').order('created_at'),
    supabase.from('profiles').select('outlet_id'),
  ])
  if (error) {
    return (
      <div className="mx-auto max-w-[900px] px-8 py-16">
        <p className="rounded-lg border border-draft/40 bg-draft/10 px-5 py-4 text-sm">그룹 관리를 쓰려면 Supabase에서 <code>supabase/groups.sql</code>을 실행해 주세요.</p>
      </div>
    )
  }

  // 매체별 회원·기사 수
  const counts = await Promise.all(
    (outlets ?? []).map((o) => supabase.from('articles').select('id', { count: 'exact', head: true }).eq('outlet_id', o.id))
  )
  const list = (outlets ?? []).map((o, i) => ({
    ...o,
    publisher_id: (o as any).publisher_id ?? null,
    members: (members ?? []).filter((m) => m.outlet_id === o.id).length,
    articles: counts[i].count ?? 0,
  }))

  return (
    <div className="mx-auto max-w-[960px] px-8 py-8">
      <header className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight">{isSuper ? '그룹·매체 관리' : '우리 그룹 매체'}</h1>
        <p className="mt-1 text-[13px] text-muted">
          {isSuper
            ? '모든 고객 그룹과 매체를 관리합니다. 그룹끼리는 기사·회원·보도자료·청구서가 서로 보이지 않습니다.'
            : '그룹 안의 매체를 만들고 관리합니다. 위쪽 매체 이름을 눌러 작업할 매체를 바꿀 수 있습니다.'}
        </p>
      </header>
      <GroupOutlets groups={groups ?? []} outlets={list} isSuper={isSuper} myGroupId={publisherId} currentOutletId={outletId} />
    </div>
  )
}
