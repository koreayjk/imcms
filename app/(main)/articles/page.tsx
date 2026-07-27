import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { STATUS_LABEL, type ArticleStatus } from '@/lib/types'

const TABS: { value: ArticleStatus | 'all'; label: string }[] = [
  { value: 'all', label: '전체' },
  { value: 'draft', label: '초안' },
  { value: 'in_review', label: '검토중' },
  { value: 'published', label: '발행됨' },
  { value: 'rejected', label: '반려' },
]

type Props = { searchParams: { status?: string; q?: string; mine?: string } }

export default async function ArticlesPage({ searchParams }: Props) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, outlet_id')
    .eq('id', user.id)
    .single()

  const isEditorPlus = profile?.role === 'editor' || profile?.role === 'admin'
  const statusFilter = searchParams.status as ArticleStatus | undefined
  const searchQuery = searchParams.q?.trim()
  const mineOnly = searchParams.mine === '1' || !isEditorPlus

  // 기사 조회
  let query = supabase
    .from('articles')
    .select('id, title, status, created_at, updated_at, is_featured, reject_reason, author:profiles!articles_author_id_fkey(full_name), category:categories(name)')
    .order('created_at', { ascending: false })

  if (mineOnly) query = query.eq('author_id', user.id)
  if (statusFilter) query = query.eq('status', statusFilter)
  if (searchQuery) query = query.ilike('title', `%${searchQuery}%`)

  const { data: articles } = await query

  // 통계 (상태별 개수)
  let countQuery = supabase.from('articles').select('status')
  if (mineOnly) countQuery = countQuery.eq('author_id', user.id)
  const { data: allForCount } = await countQuery

  const counts = {
    all: allForCount?.length || 0,
    draft: allForCount?.filter(a => a.status === 'draft').length || 0,
    in_review: allForCount?.filter(a => a.status === 'in_review').length || 0,
    published: allForCount?.filter(a => a.status === 'published').length || 0,
    rejected: allForCount?.filter(a => a.status === 'rejected').length || 0,
  }

  const baseUrl = mineOnly && isEditorPlus ? '/articles?mine=1' : '/articles'

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold">기사 목록</h1>
          {isEditorPlus && (
            <div className="flex gap-3 mt-1 text-xs text-muted">
              <Link
                href="/articles"
                className={!mineOnly ? 'text-ink font-medium' : 'hover:text-ink'}
              >
                전체 기사
              </Link>
              <Link
                href="/articles?mine=1"
                className={mineOnly && isEditorPlus ? 'text-ink font-medium' : 'hover:text-ink'}
              >
                내 기사
              </Link>
            </div>
          )}
        </div>
        <Link href="/articles/new" className="btn-primary">
          + 새 기사
        </Link>
      </div>

      {/* 통계 카드 */}
      <div className="grid grid-cols-5 gap-2 mb-6">
        {[
          { key: 'all', label: '전체', color: 'text-ink' },
          { key: 'draft', label: '초안', color: 'text-draft' },
          { key: 'in_review', label: '검토중', color: 'text-review' },
          { key: 'published', label: '발행됨', color: 'text-published' },
          { key: 'rejected', label: '반려', color: 'text-danger' },
        ].map(({ key, label, color }) => (
          <div key={key} className="rounded border border-line px-3 py-3 text-center">
            <div className={`text-xl font-semibold tabular-nums ${color}`}>
              {counts[key as keyof typeof counts]}
            </div>
            <div className="text-[11px] text-muted mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* 검색 */}
      <form method="get" action="/articles" className="mb-4 flex gap-2">
        {mineOnly && <input type="hidden" name="mine" value="1" />}
        {statusFilter && <input type="hidden" name="status" value={statusFilter} />}
        <input
          name="q"
          defaultValue={searchQuery}
          placeholder="제목 검색..."
          className="field-input max-w-xs"
        />
        <button type="submit" className="btn-secondary px-3 py-2 text-sm">검색</button>
        {searchQuery && (
          <Link href={baseUrl + (statusFilter ? `&status=${statusFilter}` : '')} className="btn-secondary px-3 py-2 text-sm">
            초기화
          </Link>
        )}
      </form>

      {/* 상태 탭 */}
      <div className="flex border-b border-line mb-0">
        {TABS.map(({ value, label }) => {
          const isActive = value === 'all' ? !statusFilter : statusFilter === value
          const count = counts[value === 'all' ? 'all' : value as ArticleStatus]
          const href = value === 'all'
            ? (mineOnly && isEditorPlus ? '/articles?mine=1' : '/articles') + (searchQuery ? `&q=${searchQuery}` : '')
            : `/articles?status=${value}` + (mineOnly && isEditorPlus ? '&mine=1' : '') + (searchQuery ? `&q=${searchQuery}` : '')
          return (
            <Link
              key={value}
              href={href}
              className={`px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
                isActive
                  ? 'border-ink text-ink font-medium'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {label}
              <span className="ml-1.5 text-xs tabular-nums opacity-60">{count}</span>
            </Link>
          )
        })}
      </div>

      {/* 기사 테이블 */}
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="py-2.5 font-normal text-muted">제목</th>
            <th className="py-2.5 font-normal text-muted w-24">카테고리</th>
            {isEditorPlus && !mineOnly && (
              <th className="py-2.5 font-normal text-muted w-20">기자</th>
            )}
            <th className="py-2.5 font-normal text-muted w-16">상태</th>
            <th className="py-2.5 font-normal text-muted w-24">작성일</th>
            <th className="py-2.5 w-14"></th>
          </tr>
        </thead>
        <tbody>
          {articles?.map((a) => (
            <tr key={a.id} className="border-b border-line/60 hover:bg-line/20 group">
              <td className="py-3 pr-4">
                <div className="flex items-center gap-1.5">
                  {a.is_featured && (
                    <span className="text-xs text-draft font-bold" title="주요 기사">★</span>
                  )}
                  <Link
                    href={`/articles/${a.id}`}
                    className="font-medium hover:underline line-clamp-1"
                  >
                    {a.title}
                  </Link>
                </div>
                {a.status === 'rejected' && a.reject_reason && (
                  <p className="text-xs text-danger mt-0.5 truncate max-w-md">
                    반려: {a.reject_reason}
                  </p>
                )}
              </td>
              <td className="py-3 text-xs text-muted">{(a.category as any)?.name || '-'}</td>
              {isEditorPlus && !mineOnly && (
                <td className="py-3 text-xs text-muted">{(a.author as any)?.full_name || '-'}</td>
              )}
              <td className="py-3">
                <span className={`status-badge status-${a.status}`}>
                  {STATUS_LABEL[a.status as ArticleStatus]}
                </span>
              </td>
              <td className="py-3 text-xs text-muted">
                {new Date(a.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
              </td>
              <td className="py-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link href={`/articles/${a.id}/edit`} className="text-xs text-muted hover:text-ink">
                  수정
                </Link>
              </td>
            </tr>
          ))}
          {!articles?.length && (
            <tr>
              <td colSpan={isEditorPlus && !mineOnly ? 6 : 5} className="py-16 text-center text-muted text-sm">
                {searchQuery
                  ? `"${searchQuery}"에 해당하는 기사가 없습니다.`
                  : statusFilter
                  ? `${STATUS_LABEL[statusFilter as ArticleStatus]} 상태의 기사가 없습니다.`
                  : '기사가 없습니다.'}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <div className="mt-3 text-xs text-muted">
        총 {articles?.length ?? 0}건
      </div>
    </div>
  )
}
