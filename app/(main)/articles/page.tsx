import Link from 'next/link'
import { getCmsContext } from '@/lib/cms'
import { formatDateTime } from '@/lib/format'
import { ImageIcon } from '@/components/cms/icons'
import { STATUS_LABEL, type ArticleStatus } from '@/lib/types'
import PendingButton from '@/components/cms/PendingButton'
import { deleteArticle } from './actions'

const TABS: (ArticleStatus | 'all')[] = ['all', 'draft', 'in_review', 'rejected', 'published']
const PAGE_SIZE = 30

type Props = { searchParams: { status?: string; q?: string; mine?: string; page?: string; deleted?: string } }

export default async function ArticlesPage({ searchParams }: Props) {
  const { supabase, user, outletId, isEditorPlus } = await getCmsContext()

  const status = TABS.includes(searchParams.status as ArticleStatus) ? (searchParams.status as ArticleStatus) : undefined
  const q = searchParams.q?.trim().slice(0, 100) || undefined
  const mineOnly = searchParams.mine === '1' || !isEditorPlus
  const page = Math.max(1, Number(searchParams.page) || 1)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scoped = (query: any) => {
    let out = query
    if (mineOnly) out = out.eq('author_id', user.id)
    if (outletId) out = out.eq('outlet_id', outletId)
    return out
  }

  let listQuery = scoped(
    supabase
      .from('articles')
      .select('id, title, status, thumbnail_url, view_count, updated_at, published_at, reject_reason, is_featured, author_id, author:profiles!articles_author_id_fkey(full_name), category:categories(name)', { count: 'exact' })
  )
  if (status) listQuery = listQuery.eq('status', status)
  if (q) listQuery = listQuery.ilike('title', `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)

  const [{ data, count }, ...tabCounts] = await Promise.all([
    listQuery.order('updated_at', { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    ...TABS.map((t) => {
      const c = scoped(supabase.from('articles').select('id', { count: 'exact', head: true }))
      return t === 'all' ? c : c.eq('status', t)
    }),
  ])

  const rows = (data ?? []) as any[]
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))
  const href = (params: Record<string, string | undefined>) => {
    const sp = new URLSearchParams()
    const merged = { mine: mineOnly && isEditorPlus ? '1' : undefined, status, q, ...params }
    Object.entries(merged).forEach(([k, v]) => v && sp.set(k, v))
    const s = sp.toString()
    return `/articles${s ? `?${s}` : ''}`
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-5 md:px-8 md:py-8">
      <div className="mb-5 flex items-end justify-between gap-3 md:mb-6">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">기사목록</h1>
          {isEditorPlus && (
            <div className="mt-2 flex gap-1 text-[13px]">
              <Link href={href({ mine: undefined, page: undefined })} className={`rounded px-2.5 py-1 ${!mineOnly ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>편집국 전체</Link>
              <Link href={href({ mine: '1', page: undefined })} className={`rounded px-2.5 py-1 ${mineOnly ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}>내 기사</Link>
            </div>
          )}
        </div>
        <Link href="/articles/new" className="btn-primary shrink-0 px-4 py-2.5 md:px-5">+ 기사쓰기</Link>
      </div>

      {searchParams.deleted && (
        <p role="status" className="mb-4 rounded-lg border border-line bg-white px-5 py-3 text-[13.5px]">기사를 삭제했습니다.</p>
      )}

      <section className="rounded-lg border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-x-3 border-b border-line px-2 md:px-5">
          <nav className="-mx-2 flex max-w-full overflow-x-auto px-2 md:mx-0 md:px-0" aria-label="기사 상태">
            {TABS.map((t, i) => {
              const active = t === 'all' ? !status : status === t
              return (
                <Link
                  key={t}
                  href={href({ status: t === 'all' ? undefined : t, page: undefined })}
                  aria-current={active ? 'page' : undefined}
                  className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-2.5 py-3.5 text-[14px] md:px-4 ${active ? 'border-ink font-bold text-ink' : 'border-transparent text-muted hover:text-ink'}`}
                >
                  {t === 'all' ? '전체' : STATUS_LABEL[t]}
                  <span className="ml-1.5 text-[12px] tabular-nums opacity-60">{tabCounts[i].count ?? 0}</span>
                </Link>
              )
            })}
          </nav>
          <form action="/articles" className="flex w-full items-center gap-2 px-2 py-2 md:w-auto md:px-0">
            {mineOnly && isEditorPlus && <input type="hidden" name="mine" value="1" />}
            {status && <input type="hidden" name="status" value={status} />}
            <label htmlFor="list-q" className="sr-only">제목 검색</label>
            <input id="list-q" name="q" defaultValue={q} placeholder="제목 검색" className="field-input h-9 min-w-0 flex-1 py-1.5 md:w-56 md:flex-none" />
            <button type="submit" className="btn-secondary h-9 py-1.5">검색</button>
            {q && <Link href={href({ q: undefined, page: undefined })} className="text-[12.5px] text-muted hover:text-ink">초기화</Link>}
          </form>
        </div>

        {rows.length ? (
          <ul className="divide-y divide-line">
            {rows.map((a) => (
              <li key={a.id} className="group flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3.5 hover:bg-[#F8F9FA] md:flex-nowrap md:gap-4 md:px-5">
                <span className={`status-badge status-${a.status} w-[58px] shrink-0 justify-center`}>{STATUS_LABEL[a.status as ArticleStatus]}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {a.is_featured && <span className="text-[12px] font-bold text-draft" title="주요 기사">★</span>}
                    <Link href={`/articles/${a.id}`} className="line-clamp-2 text-[14.5px] font-medium hover:underline md:truncate">{a.title}</Link>
                    {a.thumbnail_url && <span className="shrink-0 text-muted" title="사진 있음"><ImageIcon /></span>}
                    {a.status === 'published' && <span className="hidden shrink-0 text-[12px] tabular-nums text-muted md:inline">조회 {a.view_count ?? 0}</span>}
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-muted md:hidden">
                    {[a.category?.name ?? '섹션 없음', `${a.author?.full_name ?? ''} 기자`, a.status === 'published' ? `조회 ${a.view_count ?? 0}` : null, formatDateTime(a.status === 'published' ? a.published_at : a.updated_at)].filter(Boolean).join(' · ')}
                  </p>
                  {a.status === 'rejected' && a.reject_reason && <p className="mt-0.5 truncate text-[12px] text-danger">반려 사유: {a.reject_reason}</p>}
                </div>
                <span className="hidden w-24 shrink-0 truncate text-[12.5px] text-muted md:block">{a.category?.name ?? '섹션 없음'}</span>
                <span className="hidden w-20 shrink-0 truncate text-[12.5px] text-muted md:block">{a.author?.full_name} 기자</span>
                <time className="hidden w-[118px] shrink-0 text-right text-[12.5px] tabular-nums text-muted md:block">
                  {formatDateTime(a.status === 'published' ? a.published_at : a.updated_at)}
                </time>
                <div className="flex w-full shrink-0 justify-end gap-4 text-[13px] md:w-[72px] md:gap-2.5 md:text-[12.5px] md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                  <Link href={`/articles/${a.id}/edit`} className="text-muted hover:text-ink">수정</Link>
                  {(a.author_id === user.id || isEditorPlus) && (
                    <form action={deleteArticle.bind(null, a.id)}>
                      <PendingButton
                        pending="…"
                        confirm={`“${a.title}” 기사를 삭제할까요?${a.status === 'published' ? '\n홈페이지에서도 바로 내려가고, 함께 송고된 다른 매체 사본도 삭제됩니다.' : ''}\n삭제하면 되돌릴 수 없습니다.`}
                        className="text-muted hover:text-danger"
                      >
                        삭제
                      </PendingButton>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="py-20 text-center text-[14px] text-muted">
            {q ? `‘${q}’에 해당하는 기사가 없습니다.` : status ? `${STATUS_LABEL[status]} 상태의 기사가 없습니다.` : '아직 작성한 기사가 없습니다.'}
          </p>
        )}
      </section>

      <div className="mt-4 flex items-center justify-between text-[12.5px] text-muted">
        <span>총 <span className="tabular-nums">{(count ?? 0).toLocaleString()}</span>건</span>
        {pages > 1 && (
          <nav className="flex flex-wrap justify-end gap-1" aria-label="페이지">
            {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
              <Link
                key={p}
                href={href({ page: p > 1 ? String(p) : undefined })}
                aria-current={p === page ? 'page' : undefined}
                className={`grid h-8 min-w-8 place-items-center rounded border px-2 tabular-nums ${p === page ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:border-ink'}`}
              >
                {p}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </div>
  )
}
