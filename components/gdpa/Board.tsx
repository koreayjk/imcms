import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BOARD_LABEL, type GdpaBoard } from '@/lib/gdpa'
import { boardPost, boardPosts } from '@/lib/gdpa-data'
import { formatDate } from '@/lib/format'
import SubPage from './SubPage'

const SECTION: Record<GdpaBoard, string> = { notice: '/notice', data: '/notice', activity: '/activity' }
const PATH: Record<GdpaBoard, string> = { notice: '/notice', data: '/data', activity: '/activity' }
const SIZE = 15

// 게시판 목록 (공지사항·자료실·협회 활동)
export async function BoardList({ base, board, page }: { base: string; board: GdpaBoard; page: number }) {
  const { items, total } = await boardPosts(board, page, SIZE)
  const pages = Math.max(1, Math.ceil(total / SIZE))
  return (
    <SubPage base={base} section={SECTION[board]} current={PATH[board]} title={BOARD_LABEL[board]}>
      <p className="mb-3 text-[14px] text-[var(--g-sub)]">전체 <strong className="text-[var(--g-navy)]">{total}</strong>건</p>
      <ul className="divide-y divide-[var(--g-line)] border-y-2 border-[var(--g-navy)]">
        {items.map((p, i) => (
          <li key={p.id}>
            <Link href={`${base}${PATH[board]}/${p.id}`} className="flex items-center gap-4 px-2 py-4 hover:bg-[var(--g-soft)]">
              <span className="w-12 shrink-0 text-center text-[13px] text-[var(--g-sub)]">
                {p.pinned ? <span className="rounded bg-[var(--g-navy)] px-1.5 py-0.5 text-[11px] font-bold text-white">공지</span> : total - ((page - 1) * SIZE + i)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[16px]">{p.title}</span>
              <span className="shrink-0 text-[13px] tabular-nums text-[var(--g-sub)]">{formatDate(p.created_at)}</span>
            </Link>
          </li>
        ))}
        {!items.length && <li className="py-16 text-center text-[15px] text-[var(--g-sub)]">아직 올라온 글이 없습니다.</li>}
      </ul>
      {pages > 1 && (
        <nav className="mt-8 flex justify-center gap-1" aria-label="페이지">
          {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
            <Link key={p} href={`${base}${PATH[board]}${p > 1 ? `?page=${p}` : ''}`} aria-current={p === page ? 'page' : undefined}
              className={`grid h-9 min-w-9 place-items-center border px-2 text-[14px] ${p === page ? 'border-[var(--g-navy)] bg-[var(--g-navy)] text-white' : 'border-[var(--g-line)]'}`}>{p}</Link>
          ))}
        </nav>
      )}
    </SubPage>
  )
}

// 글 보기 (본문은 줄바꿈을 문단으로, 주소는 링크로)
export async function BoardView({ base, board, id }: { base: string; board: GdpaBoard; id: string }) {
  const post = await boardPost(id)
  if (!post || post.board !== board) notFound()
  const paras = post.body.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  const linkify = (t: string) => t.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="break-all text-[var(--g-navy)] underline">{part}</a> : part)
  return (
    <SubPage base={base} section={SECTION[board]} current={PATH[board]} title={BOARD_LABEL[board]}>
      <article>
        <header className="border-b border-[var(--g-line)] border-t-2 border-t-[var(--g-navy)] px-2 py-5">
          <h2 className="text-[22px] font-bold leading-[1.45]">{post.title}</h2>
          <p className="mt-2 text-[13px] text-[var(--g-sub)]">{formatDate(post.created_at)} · {post.board === 'notice' ? '사무국' : '협회'}</p>
        </header>
        <div className="space-y-4 px-2 py-8 text-[16px] leading-[1.9]">
          {paras.map((p, i) => <p key={i} className="whitespace-pre-line">{linkify(p)}</p>)}
        </div>
      </article>
      <div className="border-t border-[var(--g-line)] pt-6">
        <Link href={`${base}${PATH[board]}`} className="rounded border border-[var(--g-line)] px-5 py-2.5 text-[14px] font-semibold">목록</Link>
      </div>
    </SubPage>
  )
}
