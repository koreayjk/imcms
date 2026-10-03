import type { Metadata } from 'next'
import Link from 'next/link'
import { gdpaBase } from '@/lib/gdpa-server'
import { memberNews } from '@/lib/gdpa-data'
import { formatDate } from '@/lib/format'
import SubPage from '@/components/gdpa/SubPage'

export const metadata: Metadata = { title: '회원사 뉴스' }
export const revalidate = 300

const SIZE = 18

// 회원사 최신 기사 모음 (누르면 각 회원사 홈페이지 기사로)
export default async function News({ searchParams }: { searchParams: { page?: string } }) {
  const base = gdpaBase()
  const page = Math.max(1, Number(searchParams.page) || 1)
  const { items, total } = await memberNews(SIZE, page)
  const pages = Math.min(20, Math.max(1, Math.ceil(total / SIZE)))
  return (
    <SubPage base={base} section="/news" current="/news" title="회원사 뉴스" wide>
      <p className="mb-6 text-[15px] text-[var(--g-sub)]">회원사 홈페이지에 실린 최신 기사입니다. 기사를 누르면 해당 회원사 홈페이지에서 열립니다.</p>
      <ul className="grid gap-x-6 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((n) => (
          <li key={n.id}>
            <a href={n.url} target="_blank" rel="noopener" className="group block">
              <div className="aspect-[3/2] overflow-hidden rounded bg-[var(--g-soft)]">
                {n.thumb ? <img src={n.thumb} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.03]" /> : <span className="grid h-full place-items-center text-[13px] text-[var(--g-sub)]">{n.outlet}</span>}
              </div>
              <p className="mt-3 text-[12.5px] font-semibold text-[var(--g-gold-ink)]">{n.outlet}</p>
              <p className="mt-0.5 line-clamp-2 text-[17px] font-bold leading-[1.45] group-hover:underline group-hover:underline-offset-4">{n.title}</p>
              {n.excerpt && <p className="mt-1 line-clamp-2 text-[14px] leading-[1.6] text-[var(--g-sub)]">{n.excerpt}</p>}
              <p className="mt-1.5 text-[12px] text-[var(--g-sub)]">{formatDate(n.publishedAt)}</p>
            </a>
          </li>
        ))}
      </ul>
      {!items.length && <p className="py-20 text-center text-[15px] text-[var(--g-sub)]">회원사 기사가 곧 이곳에 모입니다.</p>}
      {pages > 1 && (
        <nav className="mt-10 flex flex-wrap justify-center gap-1" aria-label="페이지">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link key={p} href={`${base}/news${p > 1 ? `?page=${p}` : ''}`} aria-current={p === page ? 'page' : undefined}
              className={`grid h-9 min-w-9 place-items-center border px-2 text-[14px] ${p === page ? 'border-[var(--g-navy)] bg-[var(--g-navy)] text-white' : 'border-[var(--g-line)]'}`}>{p}</Link>
          ))}
        </nav>
      )}
    </SubPage>
  )
}
