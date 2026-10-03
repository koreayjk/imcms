import Link from 'next/link'
import type { ReactNode } from 'react'
import type { ArticleSource, PublicArticle } from '@/lib/public-data'
import { reporterHref } from '@/lib/reporter'
import { formatDateTime } from '@/lib/format'
import SectionHeading from './SectionHeading'
import Thumb from './Thumb'
import OptImg from './OptImg'
import { optimizeBodyImages } from '@/lib/image-url'
import ShareButton from './ShareButton'

// 홈페이지 기사 본문 (제목·부제·기자·본문·관련기사·태그·기자 정보·섹션 다른 기사). 실제 기사 화면과 기사쓰기 미리보기가 같이 쓴다
// bodyHtml은 이미 정리(sanitizeBody)한 HTML
export default function ArticleMain({ a, bodyHtml, sectionName, siteName, source = null, related = [], relatedLinks = [], bottomAd }: {
  a: PublicArticle
  bodyHtml: string
  sectionName?: string
  siteName: string
  source?: ArticleSource | null
  related?: PublicArticle[]
  // 본문 아래 '관련기사' 글 목록 (태그가 겹치는 기사)
  relatedLinks?: PublicArticle[]
  bottomAd?: ReactNode
}) {
  return (
    <article className="min-w-0">
      <header className="border-b border-rule pb-5">
        {a.category && (
          <Link href={`/section/${a.category.slug}`} className="text-[13px] font-semibold text-gold-ink hover:underline">
            {sectionName ?? a.category.name}
          </Link>
        )}
        <h1 className="mt-2 text-balance text-[25px] font-extrabold leading-[1.35] tracking-[-0.035em] text-body lg:text-[34px]">
          {a.title}
        </h1>
        {a.excerpt && (
          <p className="mt-4 whitespace-pre-line border-l-[3px] border-gold pl-4 text-[15.5px] leading-[1.7] text-sub lg:text-[17px]">{a.excerpt}</p>
        )}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-[13px] text-sub">
          <p className="tabular-nums">
            {a.author_name && <span className="font-semibold text-body">{a.author_name} 기자</span>}
            {a.author_email && <a href={`mailto:${a.author_email}`} className="ml-1.5 text-sub hover:text-brand">{a.author_email}</a>}
            <span className="mx-2 text-rule" aria-hidden>|</span>
            <span>입력 {formatDateTime(a.published_at)}</span>
            {a.view_count > 0 && (
              <>
                <span className="mx-2 text-rule" aria-hidden>|</span>
                <span>조회 {a.view_count.toLocaleString()}</span>
              </>
            )}
          </p>
          <ShareButton title={a.title} />
        </div>
      </header>

      {a.thumbnail_url && !/<img\s/i.test(bodyHtml) && (
        <figure className="mt-7">
          <OptImg src={a.thumbnail_url} alt={a.title} className="w-full" />
        </figure>
      )}

      <div
        className="article-content mt-7 text-[17px] leading-[1.95] text-body lg:text-[17.5px]"
        dangerouslySetInnerHTML={{ __html: optimizeBodyImages(bodyHtml) }}
      />

      {relatedLinks.length > 0 && (
        <section aria-labelledby="related-links" className="mt-10">
          <h2 id="related-links" className="text-[17px] font-bold text-body">관련기사</h2>
          <ul className="mt-3 space-y-2.5">
            {relatedLinks.map((r) => (
              <li key={r.id} className="flex gap-1.5 text-[15px] leading-[1.5]">
                <span aria-hidden className="text-sub">↳</span>
                <Link href={`/news/${r.id}`} className="text-brand hover:underline">{r.title}</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {bottomAd}

      {a.tags && a.tags.length > 0 && (
        <ul className="mt-8 flex flex-wrap gap-2">
          {a.tags.map((t) => (
            <li key={t}>
              <Link href={`/search?q=${encodeURIComponent(t)}`} className="block rounded-full bg-soft px-3 py-1 text-[13px] text-sub hover:text-brand">
                #{t}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {a.author_name && (
        <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-rule pt-5">
          <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand text-[15px] font-bold text-white">
            {a.author_name.trim().charAt(0)}
          </span>
          <span className="text-[15px] font-bold text-body">{a.author_name} 기자</span>
          {a.author_email && <a href={`mailto:${a.author_email}`} className="text-[13px] text-sub hover:text-brand">{a.author_email}</a>}
          <Link
            href={reporterHref(a.author_name)}
            className="bg-[linear-gradient(transparent_60%,color-mix(in_srgb,var(--brand)_22%,transparent)_60%)] text-[13.5px] font-medium text-body hover:text-brand"
          >
            다른기사 보기
          </Link>
        </div>
      )}

      <p className={`${a.author_name ? 'mt-5' : 'mt-8'} border-y border-rule py-4 text-[13px] text-sub`}>
        {source ? (
          <>
            이 기사는 <strong className="text-body">{source.outletName}</strong>에서 제공한 기사입니다.
            {source.url && (
              <a href={source.url} className="ml-2 text-brand underline underline-offset-2">원문 보기</a>
            )}
          </>
        ) : (
          <>저작권자 © {siteName} 무단전재 및 재배포 금지</>
        )}
      </p>

      {related.length > 0 && (
        <section className="mt-10">
          <SectionHeading title={`${sectionName ?? '관련'} 다른 기사`} href={a.category ? `/section/${a.category.slug}` : undefined} />
          <ul className="grid grid-cols-2 gap-x-5 gap-y-6 lg:grid-cols-4">
            {related.map((r) => (
              <li key={r.id}>
                <Link href={`/news/${r.id}`} className="headline-link group block">
                  <Thumb src={r.thumbnail_url} alt={r.title} ratio="3 / 2" />
                  <p className="headline-text mt-2.5 line-clamp-2 text-[14.5px] font-semibold leading-[1.45]">{r.title}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  )
}
