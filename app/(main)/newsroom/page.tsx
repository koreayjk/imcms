import Link from 'next/link'
import { getCmsContext } from '@/lib/cms'
import { formatDateTime } from '@/lib/format'
import { STATUS_LABEL, type ArticleStatus } from '@/lib/types'

const CARDS: { status: ArticleStatus; tone: string; note: string }[] = [
  { status: 'draft', tone: 'bg-[#F2B544] text-[#3B2A00]', note: '저장만 하고 아직 제출하지 않은 기사' },
  { status: 'in_review', tone: 'bg-[#3D7BE0] text-white', note: '편집장 승인을 기다리는 기사' },
  { status: 'rejected', tone: 'bg-[#D9534F] text-white', note: '수정이 필요한 기사' },
  { status: 'published', tone: 'bg-[#2E8B57] text-white', note: '홈페이지에 공개된 기사' },
]

type Props = { searchParams: { tab?: string } }

export default async function NewsroomPage({ searchParams }: Props) {
  const { supabase, user, outletId, isEditorPlus } = await getCmsContext()
  const tab = (CARDS.find((c) => c.status === searchParams.tab)?.status ?? 'draft') as ArticleStatus

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scoped = (q: any) => {
    let out = q
    if (!isEditorPlus) out = out.eq('author_id', user.id)
    if (outletId) out = out.eq('outlet_id', outletId)
    return out
  }

  const countOf = (status: ArticleStatus) =>
    scoped(supabase.from('articles').select('id', { count: 'exact', head: true })).eq('status', status)

  const [counts, list, reviewQueue, popular] = await Promise.all([
    Promise.all(CARDS.map((c) => countOf(c.status))),
    scoped(
      supabase
        .from('articles')
        .select('id, title, status, updated_at, published_at, view_count, reject_reason, author:profiles!articles_author_id_fkey(full_name), category:categories(name)')
    ).eq('status', tab).order(tab === 'published' ? 'published_at' : 'updated_at', { ascending: false }).limit(12),
    isEditorPlus
      ? scoped(supabase.from('articles').select('id, title, updated_at, author:profiles!articles_author_id_fkey(full_name)'))
          .eq('status', 'in_review').order('updated_at', { ascending: true }).limit(6)
      : Promise.resolve({ data: [] as any[] }),
    scoped(supabase.from('articles').select('id, title, view_count'))
      .eq('status', 'published').order('view_count', { ascending: false }).limit(5),
  ])

  const rows = (list.data ?? []) as any[]

  return (
    <div className="mx-auto max-w-[1280px] px-8 py-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">뉴스룸</h1>
          <p className="mt-1 text-[13px] text-muted">{isEditorPlus ? '편집국 전체 기사 현황' : '내 기사 현황'}</p>
        </div>
        <Link href="/articles/new" className="btn-primary px-5 py-2.5">+ 기사쓰기</Link>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {CARDS.map((c, i) => (
          <Link
            key={c.status}
            href={`/newsroom?tab=${c.status}`}
            aria-current={tab === c.status ? 'true' : undefined}
            className={`rounded-lg px-6 py-5 transition-transform hover:-translate-y-0.5 ${c.tone} ${tab === c.status ? 'ring-2 ring-offset-2 ring-ink/70' : ''}`}
          >
            <div className="text-[40px] font-bold leading-none tabular-nums">{counts[i].count ?? 0}</div>
            <div className="mt-2 text-[15px] font-semibold">{STATUS_LABEL[c.status]}</div>
            <div className="mt-0.5 text-[12px] opacity-80">{c.note}</div>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-[1fr_340px] gap-6">
        <section className="rounded-lg border border-line bg-white">
          <div className="flex items-center justify-between border-b border-line px-5">
            <div className="flex">
              {CARDS.map((c, i) => (
                <Link
                  key={c.status}
                  href={`/newsroom?tab=${c.status}`}
                  className={`-mb-px border-b-2 px-4 py-3.5 text-[14px] ${
                    tab === c.status ? 'border-ink font-bold text-ink' : 'border-transparent text-muted hover:text-ink'
                  }`}
                >
                  {STATUS_LABEL[c.status]}
                  <span className="ml-1.5 rounded-full bg-line/80 px-1.5 text-[11px] tabular-nums text-muted">{counts[i].count ?? 0}</span>
                </Link>
              ))}
            </div>
            <Link href={`/articles?status=${tab}`} className="text-[12.5px] text-muted hover:text-ink">더보기 +</Link>
          </div>

          {rows.length ? (
            <ul className="divide-y divide-line">
              {rows.map((a) => (
                <li key={a.id}>
                  <Link href={a.status === 'published' ? `/articles/${a.id}` : `/articles/${a.id}/edit`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#F8F9FA]">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14.5px] font-medium">{a.title}</p>
                      {a.status === 'rejected' && a.reject_reason && (
                        <p className="mt-0.5 truncate text-[12px] text-danger">반려 사유: {a.reject_reason}</p>
                      )}
                    </div>
                    <span className="w-24 shrink-0 truncate text-[12px] text-muted">{a.category?.name ?? '섹션 없음'}</span>
                    {isEditorPlus && <span className="w-16 shrink-0 truncate text-[12px] text-muted">{a.author?.full_name}</span>}
                    {a.status === 'published' && (
                      <span className="w-14 shrink-0 text-right text-[12px] tabular-nums text-muted">조회 {a.view_count ?? 0}</span>
                    )}
                    <time className="w-[118px] shrink-0 text-right text-[12px] tabular-nums text-muted">
                      {formatDateTime(a.status === 'published' ? a.published_at : a.updated_at)}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-16 text-center text-[14px] text-muted">{STATUS_LABEL[tab]} 상태의 기사가 없습니다.</p>
          )}
        </section>

        <aside className="space-y-6">
          {isEditorPlus && (
            <section className="rounded-lg border border-line bg-white">
              <h2 className="flex items-center gap-2 border-b border-line px-5 py-3.5 text-[14px] font-bold">
                승인 대기
                <span className="rounded-full bg-[#3D7BE0] px-1.5 text-[11px] text-white tabular-nums">{counts[1].count ?? 0}</span>
              </h2>
              {reviewQueue.data?.length ? (
                <ul className="divide-y divide-line">
                  {(reviewQueue.data as any[]).map((a) => (
                    <li key={a.id}>
                      <Link href={`/articles/${a.id}`} className="block px-5 py-3 hover:bg-[#F8F9FA]">
                        <p className="truncate text-[13.5px] font-medium">{a.title}</p>
                        <p className="mt-0.5 text-[12px] text-muted">{a.author?.full_name} · {formatDateTime(a.updated_at)} 신청</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-8 text-center text-[13px] text-muted">승인을 기다리는 기사가 없습니다.</p>
              )}
            </section>
          )}

          <section className="rounded-lg border border-line bg-white">
            <h2 className="border-b border-line px-5 py-3.5 text-[14px] font-bold">많이 본 기사</h2>
            {popular.data?.length ? (
              <ol className="divide-y divide-line">
                {(popular.data as any[]).map((a, i) => (
                  <li key={a.id}>
                    <Link href={`/articles/${a.id}`} className="flex gap-3 px-5 py-3 hover:bg-[#F8F9FA]">
                      <span className="w-4 shrink-0 text-[14px] font-bold tabular-nums text-[#2E8B57]">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-[13.5px]">{a.title}</span>
                      <span className="shrink-0 text-[12px] tabular-nums text-muted">{a.view_count ?? 0}</span>
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="px-5 py-8 text-center text-[13px] text-muted">아직 발행된 기사가 없습니다.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}
