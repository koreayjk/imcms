import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { formatDate } from '@/lib/format'
import { BOARD_LABEL } from '@/lib/gdpa'
import AssociationAdmin from '@/components/cms/AssociationAdmin'

type Props = { searchParams: Promise<{ tab?: string }> }

// 운영팀: 글로벌디지털언론협회(GDPA) 회원 승인 · 게시글 · 회원사
export default async function AssociationPage(props: Props) {
  const searchParams = await props.searchParams
  const { supabase, isStaff } = await getCmsContext()
  if (!isStaff) redirect('/newsroom')
  const tab = searchParams.tab === 'posts' || searchParams.tab === 'outlets' ? searchParams.tab : 'members'

  const [members, posts, memberOutlets, outlets] = await Promise.all([
    supabase.rpc('gdpa_member_list'),
    supabase.from('gdpa_posts').select('id, board, title, body, pinned, published, created_at').order('created_at', { ascending: false }).limit(100),
    supabase.from('gdpa_member_outlets').select('outlet_id, sort_order, joined_on').order('sort_order'),
    supabase.from('outlets').select('id, name, domain').order('created_at'),
  ])
  const missing = !!members.error && /gdpa|function/.test(members.error.message)

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6 md:px-8 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b-2 border-ink pb-4">
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight">언론협회 (GDPA)</h1>
          <p className="mt-0.5 text-[12.5px] text-muted">글로벌디지털언론협회 홈페이지의 회원 승인, 공지·활동·자료실 글, 회원사를 관리합니다.</p>
        </div>
        <a href="/gdpa" target="_blank" rel="noopener" className="text-[13px] text-muted underline underline-offset-2">협회 홈페이지 ↗</a>
      </div>
      {missing && <p className="mt-4 rounded-lg bg-danger/10 px-4 py-3 text-[13.5px] text-danger">Supabase에서 <code>supabase/gdpa.sql</code>을 먼저 실행해 주세요.</p>}
      <nav className="mt-4 flex gap-1 border-b border-line text-[14px]" aria-label="협회 관리">
        {([['members', '회원 승인'], ['posts', '게시글'], ['outlets', '회원사']] as const).map(([k, l]) => (
          <Link key={k} href={`/admin/association${k === 'members' ? '' : `?tab=${k}`}`} aria-current={tab === k ? 'page' : undefined}
            className={`-mb-px border-b-2 px-4 py-2.5 ${tab === k ? 'border-ink font-bold' : 'border-transparent text-muted hover:text-ink'}`}>{l}</Link>
        ))}
      </nav>
      <AssociationAdmin
        tab={tab}
        members={((members.data ?? []) as any[]).map((m) => ({ ...m, created: formatDate(m.created_at) }))}
        posts={((posts.data ?? []) as any[]).map((p) => ({ ...p, created: formatDate(p.created_at), boardLabel: BOARD_LABEL[p.board as keyof typeof BOARD_LABEL] }))}
        memberOutletIds={((memberOutlets.data ?? []) as any[]).map((m) => m.outlet_id as string)}
        outlets={(outlets.data ?? []) as { id: string; name: string; domain: string | null }[]}
      />
    </div>
  )
}
