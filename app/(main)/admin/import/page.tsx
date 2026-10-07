import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import ImportTool from '@/components/cms/ImportTool'

// 다른 프로그램(ND소프트·미디어온 등) 자료 가져오기 — 총관리자만 (이관은 운영팀이 해 드린다)
export default async function ImportPage() {
  const { supabase, isSuper, user } = await getCmsContext()
  if (!isSuper) redirect('/admin/outlets')
  const [{ data: outlets }, { data: groups }] = await Promise.all([
    supabase.from('outlets').select('id, name, domain, publisher_id').order('created_at'),
    supabase.from('publishers').select('id, name'),
  ])
  const groupName = new Map(((groups ?? []) as { id: string; name: string }[]).map((g) => [g.id, g.name]))

  return (
    <div className="mx-auto max-w-[960px] space-y-5 px-4 py-5 md:px-8 md:py-8">
      <header>
        <nav className="mb-2 text-[12.5px] text-muted"><Link href="/admin/outlets" className="hover:text-ink">매체</Link> / 다른 프로그램 자료 가져오기</nav>
        <h1 className="text-[22px] font-bold tracking-tight">다른 프로그램 자료 가져오기</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          ND소프트·미디어온 등에서 받은 기사 DB 백업(.sql)과 사진 ZIP으로 기사를 옮깁니다. 순서: 매체 고르기 → 기사 파일 → 칸·섹션 맞추기 → 사진 ZIP → 가져오기.
          옛 기사 주소로 들어오는 방문자·검색엔진은 새 기사로 넘어갑니다(도메인을 이 매체에 연결한 뒤).
        </p>
      </header>
      <ImportTool
        userId={user.id}
        outlets={((outlets ?? []) as { id: string; name: string; domain: string | null; publisher_id: string | null }[]).map((o) => ({ id: o.id, name: o.name, domain: o.domain, group: o.publisher_id ? groupName.get(o.publisher_id) ?? null : null }))}
      />
    </div>
  )
}
