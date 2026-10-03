import Link from 'next/link'
import { GDPA } from '@/lib/gdpa'
import { gdpaBase } from '@/lib/gdpa-server'
import { boardPosts, memberNews, memberOutlets } from '@/lib/gdpa-data'
import { formatDate } from '@/lib/format'

export const revalidate = 300

// 협회 첫 화면: 소개 → 회원사 → 회원사 최신 뉴스 · 공지 → 가입 안내
export default async function GdpaHome() {
  const base = gdpaBase()
  const [outlets, news, notices] = await Promise.all([memberOutlets(), memberNews(6), boardPosts('notice', 1, 5)])

  return (
    <>
      {/* 첫 화면 */}
      <section className="relative overflow-hidden bg-[var(--g-navy)] text-white">
        <svg aria-hidden className="absolute -right-40 top-1/2 h-[720px] w-[720px] -translate-y-1/2 opacity-[0.09]" viewBox="0 0 100 100">
          <g fill="none" stroke="white" strokeWidth="0.5"><circle cx="50" cy="50" r="48" /><ellipse cx="50" cy="50" rx="16" ry="48" /><ellipse cx="50" cy="50" rx="32" ry="48" /><path d="M2 50h96M6 30h88M6 70h88M14 14h72M14 86h72M50 2v96" /></g>
        </svg>
        <div className="relative mx-auto max-w-[1200px] px-4 py-20 md:py-28">
          <p className="text-[13px] font-semibold tracking-[0.28em] text-[var(--g-gold)]">{GDPA.nameEn.toUpperCase()}</p>
          <h1 className="mt-4 max-w-[760px] text-balance text-[34px] font-extrabold leading-[1.25] tracking-[-0.035em] md:text-[52px]">{GDPA.slogan}</h1>
          <p className="mt-5 max-w-[640px] text-[16px] leading-[1.75] text-white/80 md:text-[17.5px]">{GDPA.description}</p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href={`${base}/members/join`} className="rounded bg-[var(--g-gold)] px-6 py-3 text-[15px] font-bold text-[var(--g-navy-d)] hover:brightness-105">회원사 입회 안내</Link>
            <Link href={`${base}/about`} className="rounded border border-white/35 px-6 py-3 text-[15px] font-semibold text-white hover:bg-white/10">협회 소개</Link>
          </div>
        </div>
      </section>

      {/* 협회가 하는 일 */}
      <section className="mx-auto max-w-[1200px] px-4 py-16">
        <h2 className="text-[24px] font-extrabold tracking-[-0.03em] text-[var(--g-navy)]">협회가 하는 일</h2>
        <ul className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['책임 있는 저널리즘', '윤리강령과 자율 규약으로 신뢰받는 디지털 언론 문화를 만듭니다.'],
            ['회원사 협력', '기사 교류·공동 기획·기술 공유로 회원사가 함께 성장합니다.'],
            ['언론인 교육', '디지털 취재·AI 활용·언론 법률 교육으로 기자 역량을 높입니다.'],
            ['권익 보호', '회원사와 언론인의 권익을 지키고 제도 개선을 제안합니다.'],
          ].map(([t, d]) => (
            <li key={t} className="rounded-lg border border-[var(--g-line)] bg-white p-6">
              <span className="block h-1 w-8 bg-[var(--g-gold)]" />
              <h3 className="mt-4 text-[17px] font-bold">{t}</h3>
              <p className="mt-2 text-[14px] leading-[1.7] text-[var(--g-sub)]">{d}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 회원사 */}
      <section className="bg-[var(--g-soft)]">
        <div className="mx-auto max-w-[1200px] px-4 py-16">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[24px] font-extrabold tracking-[-0.03em] text-[var(--g-navy)]">회원사</h2>
              <p className="mt-1 text-[14px] text-[var(--g-sub)]">협회와 함께하는 디지털 언론사 {outlets.length}곳</p>
            </div>
            <Link href={`${base}/members`} className="text-[14px] font-semibold text-[var(--g-navy)] hover:underline">회원사 전체 보기 →</Link>
          </div>
          <ul className="mt-7 grid gap-5 md:grid-cols-3">
            {outlets.map((o) => (
              <li key={o.id}>
                <a href={o.url ?? '#'} target="_blank" rel="noopener" className="flex h-full flex-col rounded-lg border border-[var(--g-line)] bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="flex h-[64px] items-center">
                    {o.logo ? <img src={o.logo} alt={o.name} className="max-h-[56px] max-w-[240px] object-contain" /> : <span className="text-[22px] font-extrabold">{o.name}</span>}
                  </div>
                  <p className="mt-4 text-[17px] font-bold">{o.name}</p>
                  <p className="mt-1 flex-1 text-[14px] leading-[1.65] text-[var(--g-sub)]">{o.intro}</p>
                  <p className="mt-4 text-[13px] font-semibold text-[var(--g-gold-ink)]">홈페이지 바로가기 ↗</p>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 회원사 뉴스 + 공지 */}
      <section className="mx-auto grid max-w-[1200px] gap-12 px-4 py-16 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="flex items-end justify-between border-b-2 border-[var(--g-navy)] pb-3">
            <h2 className="text-[22px] font-extrabold tracking-[-0.03em] text-[var(--g-navy)]">회원사 뉴스</h2>
            <Link href={`${base}/news`} className="text-[13px] text-[var(--g-sub)] hover:text-[var(--g-navy)]">더보기 +</Link>
          </div>
          {news.items.length ? (
            <ul className="mt-5 grid gap-x-6 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
              {news.items.map((n) => (
                <li key={n.id}>
                  <a href={n.url} target="_blank" rel="noopener" className="group block">
                    <div className="aspect-[3/2] overflow-hidden rounded bg-[var(--g-soft)]">
                      {n.thumb ? <img src={n.thumb} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.03]" /> : <span className="grid h-full place-items-center text-[13px] text-[var(--g-sub)]">{n.outlet}</span>}
                    </div>
                    <p className="mt-2.5 text-[12px] font-semibold text-[var(--g-gold-ink)]">{n.outlet}</p>
                    <p className="mt-0.5 line-clamp-2 text-[15.5px] font-bold leading-[1.45] group-hover:underline group-hover:underline-offset-4">{n.title}</p>
                    <p className="mt-1 text-[12px] text-[var(--g-sub)]">{formatDate(n.publishedAt)}</p>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-14 text-center text-[14px] text-[var(--g-sub)]">회원사 기사가 곧 이곳에 모입니다.</p>
          )}
        </div>
        <aside>
          <div className="flex items-end justify-between border-b-2 border-[var(--g-navy)] pb-3">
            <h2 className="text-[22px] font-extrabold tracking-[-0.03em] text-[var(--g-navy)]">공지사항</h2>
            <Link href={`${base}/notice`} className="text-[13px] text-[var(--g-sub)] hover:text-[var(--g-navy)]">더보기 +</Link>
          </div>
          <ul className="divide-y divide-[var(--g-line)]">
            {notices.items.map((p) => (
              <li key={p.id}>
                <Link href={`${base}/notice/${p.id}`} className="flex items-baseline gap-3 py-3.5 hover:text-[var(--g-navy)]">
                  <span className="line-clamp-1 flex-1 text-[15px]">{p.pinned && <span className="mr-1.5 rounded bg-[var(--g-navy)] px-1.5 py-0.5 text-[11px] font-bold text-white">공지</span>}{p.title}</span>
                  <span className="shrink-0 text-[12px] tabular-nums text-[var(--g-sub)]">{formatDate(p.created_at)}</span>
                </Link>
              </li>
            ))}
            {!notices.items.length && <li className="py-8 text-center text-[14px] text-[var(--g-sub)]">공지사항이 없습니다.</li>}
          </ul>
          <div className="mt-8 rounded-lg bg-[var(--g-navy)] p-6 text-white">
            <p className="text-[12px] tracking-[0.2em] text-[var(--g-gold)]">JOIN GDPA</p>
            <p className="mt-2 text-[18px] font-bold">협회 회원이 되어 주세요</p>
            <p className="mt-1.5 text-[13.5px] leading-[1.65] text-white/75">회원가입 후 사무국 승인이 끝나면 회원 전용 소식과 행사·교육 안내를 받을 수 있습니다.</p>
            <Link href={`${base}/signup`} className="mt-4 inline-block rounded bg-[var(--g-gold)] px-5 py-2.5 text-[14px] font-bold text-[var(--g-navy-d)]">회원가입</Link>
          </div>
        </aside>
      </section>
    </>
  )
}
