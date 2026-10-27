import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import GroupOutlets from '@/components/cms/GroupOutlets'

export default async function OutletsPage() {
  const { supabase, isStaff, isSuper, isGroupAdmin, publisherId, outletId, viewAs, viewGroupId } = await getCmsContext()
  if (!isGroupAdmin && !isStaff) redirect('/articles')
  const { t } = await getT()

  const [{ data: groups, error }, { data: outlets }, { data: members }] = await Promise.all([
    supabase.from('publishers').select('*').order('created_at'),
    supabase.from('outlets').select('id, name, domain, publisher_id').order('created_at'),
    supabase.from('profiles').select('outlet_id'),
  ])
  if (error) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-10 md:px-8 md:py-16">
        <p className="rounded-lg border border-draft/40 bg-draft/10 px-5 py-4 text-sm">{t('그룹 관리를 쓰려면 Supabase에서 ', 'To use group management, run ')}<code>supabase/groups.sql</code>{t('을 실행해 주세요.', ' in Supabase.')}</p>
      </div>
    )
  }

  // 매체별 회원·기사 수
  // 보기 모드: 이 매체가 속한 그룹만
  const shown = viewAs ? (outlets ?? []).filter((o) => (o as any).publisher_id === viewGroupId) : (outlets ?? [])
  const counts = await Promise.all(
    shown.map((o) => supabase.from('articles').select('id', { count: 'exact', head: true }).eq('outlet_id', o.id))
  )
  const list = shown.map((o, i) => ({
    ...o,
    publisher_id: (o as any).publisher_id ?? null,
    members: (members ?? []).filter((m) => m.outlet_id === o.id).length,
    articles: counts[i].count ?? 0,
  }))

  return (
    <div className="mx-auto max-w-[960px] px-4 py-5 md:px-8 md:py-8">
      <header className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-[22px] font-bold tracking-tight">{isStaff ? t('그룹·매체 관리', 'Groups & Outlets') : t('우리 그룹 매체', 'Our group\'s outlets')}</h1>
          <div className="flex flex-wrap gap-2">
            {isSuper && <Link href="/admin/import" className="btn-secondary px-3 py-1.5 text-[13px]">{t('다른 프로그램 자료 가져오기', 'Import from another system')}</Link>}
            {isGroupAdmin && <Link href="/admin/export" className="btn-secondary px-3 py-1.5 text-[13px]">{t('자료 내보내기', 'Export data')}</Link>}
          </div>
        </div>
        <p className="mt-1 text-[13px] text-muted">
          {isStaff
            ? t('고객 그룹과 매체를 만들고 홈페이지를 설정합니다. 그룹끼리는 기사·회원·보도자료·청구서가 서로 보이지 않습니다.', 'Create customer groups and outlets and set up their websites. Groups cannot see each other\'s stories, members, press releases or invoices.')
            : t('우리 그룹의 매체입니다. “이 매체로 작업”을 누르거나 위쪽 매체 이름에서 작업할 매체를 바꿉니다.', 'These are your group\'s outlets. Click “Work on this outlet” or change the outlet from the name at the top.')}
        </p>
        {!isStaff && (
          <p className="mt-3 rounded-lg border border-review/30 bg-review/5 px-4 py-3 text-[13px] leading-relaxed">
            {t('매체 추가, 홈페이지 디자인·하단 정보·도메인 변경은 IM 뉴스룸 운영팀이 해 드립니다.', 'The IM Newsroom team handles adding outlets and changing the website design, footer information and domain.')}{' '}
            <a href="/support/tickets/new" className="font-semibold text-review underline underline-offset-2">{t('고객센터에 업무요청 쓰기 →', 'Send a work request to the Help Center →')}</a>
          </p>
        )}
      </header>
      <GroupOutlets groups={(groups ?? []).filter((g: any) => !viewAs || g.id === viewGroupId).map((g: any) => ({ id: g.id as string, name: g.name as string, solo: !!g.solo }))} outlets={list} canManage={isStaff} isSuper={isSuper} myGroupId={publisherId} currentOutletId={outletId} />
    </div>
  )
}
