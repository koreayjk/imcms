import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import GroupOutlets from '@/components/cms/GroupOutlets'

export default async function OutletsPage() {
  const { supabase, isStaff, isSuper, isGroupAdmin, publisherId, outletId } = await getCmsContext()
  if (!isGroupAdmin && !isStaff) redirect('/articles')

  const [{ data: groups, error }, { data: outlets }, { data: members }] = await Promise.all([
    supabase.from('publishers').select('*').order('created_at'),
    supabase.from('outlets').select('id, name, domain, publisher_id').order('created_at'),
    supabase.from('profiles').select('outlet_id'),
  ])
  if (error) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-10 md:px-8 md:py-16">
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
    <div className="mx-auto max-w-[960px] px-4 py-5 md:px-8 md:py-8">
      <header className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-[22px] font-bold tracking-tight">{isStaff ? '그룹·매체 관리' : '우리 그룹 매체'}</h1>
          <div className="flex gap-2">
            {isSuper && <Link href="/admin/import" className="btn-secondary px-3 py-1.5 text-[13px]">다른 프로그램 자료 가져오기</Link>}
            {isGroupAdmin && <Link href="/admin/export" className="btn-secondary px-3 py-1.5 text-[13px]">자료 내보내기</Link>}
          </div>
        </div>
        <p className="mt-1 text-[13px] text-muted">
          {isStaff
            ? '고객 그룹과 매체를 만들고 홈페이지를 설정합니다. 그룹끼리는 기사·회원·보도자료·청구서가 서로 보이지 않습니다.'
            : '우리 그룹의 매체입니다. “이 매체로 작업”을 누르거나 위쪽 매체 이름에서 작업할 매체를 바꿉니다.'}
        </p>
        {!isStaff && (
          <p className="mt-3 rounded-lg border border-review/30 bg-review/5 px-4 py-3 text-[13px] leading-relaxed">
            매체 추가, 홈페이지 디자인·하단 정보·도메인 변경은 IM 뉴스룸 운영팀이 해 드립니다.{' '}
            <a href="/support/tickets/new" className="font-semibold text-review underline underline-offset-2">고객센터에 업무요청 쓰기 →</a>
          </p>
        )}
      </header>
      <GroupOutlets groups={(groups ?? []).map((g: any) => ({ id: g.id as string, name: g.name as string, solo: !!g.solo }))} outlets={list} canManage={isStaff} isSuper={isSuper} myGroupId={publisherId} currentOutletId={outletId} />
    </div>
  )
}
