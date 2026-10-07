import Link from 'next/link'
import type { ReactNode } from 'react'
import { GDPA } from '@/lib/gdpa'
import { gdpaBase } from '@/lib/gdpa-server'
import { boardPosts, memberNews, memberOutlets } from '@/lib/gdpa-data'
import { formatDate } from '@/lib/format'

export const revalidate = 300

// 사진: public/gdpa/photos (모두 저작권 표시 없이 쓸 수 있는 사진)
//   hero — NASA ISS-49 남동유럽 야경 (퍼블릭 도메인, Wikimedia Commons)
//   journalism·partnership·education·advocacy·mission·camera·seminar·newspaper — StockSnap (CC0)
const WORK = [
  { en: 'JOURNALISM', title: '책임 있는 저널리즘', body: '윤리강령과 자율 규약으로 신뢰받는 디지털 언론 문화를 만듭니다.', img: 'journalism' },
  { en: 'PARTNERSHIP', title: '회원사 협력', body: '기사 교류·공동 기획·기술 공유로 회원사가 함께 성장합니다.', img: 'partnership' },
  { en: 'EDUCATION', title: '언론인 교육', body: '디지털 취재·AI 활용·언론 법률 교육으로 기자 역량을 높입니다.', img: 'education' },
  { en: 'ADVOCACY', title: '권익 보호', body: '회원사와 언론인의 권익을 지키고 제도 개선을 제안합니다.', img: 'advocacy' },
]

const Icon = ({ d }: { d: ReactNode }) => (
  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>
)
const QUICK = [
  { href: '/about', label: '협회 소개', sub: '인사말·비전', icon: <Icon d={<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" /></>} /> },
  { href: '/members/join', label: '입회 안내', sub: '회원사 가입 절차', icon: <Icon d={<><path d="M4 20V9l8-5 8 5v11" /><path d="M9 20v-6h6v6" /></>} /> },
  { href: '/notice', label: '공지사항', sub: '협회 소식', icon: <Icon d={<><path d="M4 10v4h3l6 4V6L7 10H4z" /><path d="M17 9a4 4 0 0 1 0 6" /></>} /> },
  { href: '/data', label: '자료실', sub: '규정·서식', icon: <Icon d={<><path d="M6 3h8l4 4v14H6z" /><path d="M14 3v4h4M9 12h6M9 16h6" /></>} /> },
  { href: '/signup', label: '회원가입', sub: '개인·회원사', icon: <Icon d={<><circle cx="10" cy="8" r="4" /><path d="M3 20c0-3.3 3.1-6 7-6M18 14v6M15 17h6" /></>} /> },
]

function Eyebrow({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <p className={`flex items-center gap-3 text-[12px] font-semibold tracking-[0.28em] ${light ? 'text-[var(--g-gold)]' : 'text-[var(--g-gold-ink)]'}`}>
      <span className="h-px w-8 bg-current" aria-hidden />{children}
    </p>
  )
}

// 협회 첫 화면: 큰 사진 → 바로가기 → 하는 일 → 인사말 → 회원사 → 회원사 뉴스·공지 → 가입 안내
export default async function GdpaHome() {
  const base = (await gdpaBase())
  const [outlets, news, notices] = await Promise.all([memberOutlets(), memberNews(6), boardPosts('notice', 1, 5)])
  const [lead, ...rest] = news.items

  return (
    <>
      {/* 첫 화면: 우주에서 본 도시의 불빛 — 세계를 잇는 디지털 언론 */}
      <section className="relative isolate overflow-hidden bg-[var(--g-navy-d)] text-white">
        <picture>
          <source media="(max-width: 767px)" srcSet="/gdpa/photos/hero-m.jpg" />
          <img src="/gdpa/photos/hero.jpg" alt="" fetchPriority="high" className="absolute inset-0 -z-10 h-full w-full object-cover object-[50%_70%]" />
        </picture>
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(180deg,rgba(8,28,51,.82)_0%,rgba(8,28,51,.45)_45%,rgba(8,28,51,.15)_70%,rgba(8,28,51,.85)_100%)]" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(8,28,51,.75)_0%,rgba(8,28,51,0)_65%)]" />
        <div className="mx-auto flex min-h-[640px] max-w-[1200px] flex-col justify-center px-4 pb-32 pt-[160px] md:min-h-[760px] md:pb-40">
          <Eyebrow light>{GDPA.nameEn.toUpperCase()}</Eyebrow>
          <h1 className="mt-6 max-w-[780px] text-balance text-[38px] font-extrabold leading-[1.2] tracking-[-0.04em] md:text-[60px]">
            디지털 시대,<br />신뢰받는 저널리즘을 <span className="text-[var(--g-gold)]">함께</span> 만듭니다
          </h1>
          <p className="mt-6 max-w-[560px] text-[16px] leading-[1.8] text-white/80 md:text-[17.5px]">{GDPA.description}</p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href={`${base}/members/join`} className="rounded-sm bg-[var(--g-gold)] px-7 py-3.5 text-[15px] font-bold text-[var(--g-navy-d)] transition hover:brightness-110">회원사 입회 안내</Link>
            <Link href={`${base}/about`} className="rounded-sm border border-white/40 px-7 py-3.5 text-[15px] font-semibold text-white backdrop-blur-sm transition hover:bg-white/10">협회 소개 →</Link>
          </div>
          <dl className="mt-14 grid max-w-[560px] grid-cols-3 border-t border-white/20 pt-6">
            {[
              ['회원사', `${outlets.length}`, '곳'],
              ['회원사 기사', news.total.toLocaleString(), '건'],
              ['창립', GDPA.founded, '년'],
            ].map(([k, v, u]) => (
              <div key={k}>
                <dt className="text-[12.5px] tracking-[0.06em] text-white/70 [text-shadow:0_1px_8px_rgba(0,0,0,.6)]">{k}</dt>
                <dd className="mt-1 text-[28px] font-extrabold tabular-nums tracking-[-0.03em] md:text-[34px]">{v}<span className="ml-0.5 text-[15px] font-semibold text-white/70">{u}</span></dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* 바로가기 (첫 화면 아래에 걸쳐 놓는다) */}
      <nav aria-label="바로가기" className="relative z-10 mx-auto -mt-16 max-w-[1200px] px-4">
        <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-md bg-[var(--g-line)] shadow-[0_24px_60px_-20px_rgba(8,28,51,.35)] ring-1 ring-black/5 sm:grid-cols-5">
          {QUICK.map((q, i) => (
            <li key={q.href} className={`bg-white ${i === QUICK.length - 1 ? 'col-span-2 sm:col-span-1' : ''}`}>
              <Link href={`${base}${q.href}`} className="group flex h-full flex-col items-center gap-2 px-3 py-6 text-center transition hover:bg-[var(--g-navy)] md:py-8">
                <span className="text-[var(--g-navy)] transition group-hover:text-[var(--g-gold)]">{q.icon}</span>
                <span className="text-[15.5px] font-bold text-[var(--g-ink)] group-hover:text-white">{q.label}</span>
                <span className="text-[12.5px] text-[var(--g-sub)] group-hover:text-white/70">{q.sub}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      {/* 협회가 하는 일 */}
      <section className="mx-auto max-w-[1200px] px-4 pb-20 pt-20 md:pt-28">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>WHAT WE DO</Eyebrow>
            <h2 className="mt-3 text-[28px] font-extrabold tracking-[-0.035em] text-[var(--g-navy)] md:text-[36px]">협회가 하는 일</h2>
          </div>
          <p className="max-w-[420px] text-[15px] leading-[1.75] text-[var(--g-sub)]">각자의 전문 분야를 가진 디지털 언론사들이 모여, 혼자서는 어려운 일을 함께 해 나갑니다.</p>
        </div>
        <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {WORK.map((w) => (
            <li key={w.title} className="group">
              <div className="relative aspect-[16/11] overflow-hidden rounded-sm bg-[var(--g-navy)] sm:aspect-[4/5]">
                <img src={`/gdpa/photos/${w.img}.jpg`} alt="" loading="lazy" className="h-full w-full object-cover opacity-90 transition duration-700 group-hover:scale-105 group-hover:opacity-100" />
                <div aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,28,51,.05)_0%,rgba(8,28,51,.55)_45%,rgba(8,28,51,.95)_100%)]" />
                <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                  <p className="text-[11px] font-semibold tracking-[0.24em] text-[var(--g-gold)]">{w.en}</p>
                  <h3 className="mt-2 text-[21px] font-bold tracking-[-0.03em]">{w.title}</h3>
                  <p className="mt-2 text-[14px] leading-[1.7] text-white/80">{w.body}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* 인사말 */}
      <section className="bg-[var(--g-soft)]">
        <div className="mx-auto grid max-w-[1200px] items-center gap-12 px-4 py-20 md:grid-cols-[1.05fr_1fr] md:gap-16 md:py-28">
          <div className="relative">
            <div aria-hidden className="absolute -bottom-4 -left-4 h-full w-full border border-[var(--g-gold)] md:-bottom-6 md:-left-6" />
            <img src="/gdpa/photos/mission.jpg" alt="도시를 내려다보는 사무실 창가의 사람들" loading="lazy" className="relative aspect-[4/3] w-full object-cover grayscale-[30%]" />
          </div>
          <div>
            <Eyebrow>GREETING</Eyebrow>
            <blockquote className="mt-5 text-[24px] font-bold leading-[1.5] tracking-[-0.03em] text-[var(--g-navy)] md:text-[30px]">
              “누구나 기사를 쓰는 시대일수록,<br className="hidden md:inline" /> 사실을 책임 있게 전하는 언론의 역할은 더 무거워집니다.”
            </blockquote>
            <p className="mt-6 text-[15.5px] leading-[1.85] text-[var(--g-sub)]">
              {GDPA.name}는 디지털 언론사들이 이 책임을 함께 나누고, 서로의 경험과 기술을 나누며 성장하기 위해 뜻을 모았습니다.
              윤리 기준을 세우고, 회원사 간 협력과 기자 교육, 언론인의 권익 보호에 힘쓰겠습니다.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-[15px] font-semibold text-[var(--g-navy)]">
              <Link href={`${base}/about`} className="border-b-2 border-[var(--g-gold)] pb-1 hover:text-[var(--g-gold-ink)]">인사말 전문</Link>
              <Link href={`${base}/about/vision`} className="border-b-2 border-transparent pb-1 hover:border-[var(--g-gold)]">설립 목적·비전</Link>
              <Link href={`${base}/about/history`} className="border-b-2 border-transparent pb-1 hover:border-[var(--g-gold)]">연혁</Link>
            </div>
          </div>
        </div>
      </section>

      {/* 회원사 */}
      <section className="mx-auto max-w-[1200px] px-4 py-20 md:py-28">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Eyebrow>MEMBERS</Eyebrow>
            <h2 className="mt-3 text-[28px] font-extrabold tracking-[-0.035em] text-[var(--g-navy)] md:text-[36px]">회원사</h2>
            <p className="mt-2 text-[15px] text-[var(--g-sub)]">협회와 함께하는 디지털 언론사 <b className="text-[var(--g-navy)]">{outlets.length}곳</b></p>
          </div>
          <Link href={`${base}/members`} className="text-[14.5px] font-semibold text-[var(--g-navy)] hover:text-[var(--g-gold-ink)]">회원사 전체 보기 →</Link>
        </div>
        <ul className="mt-10 grid gap-px overflow-hidden rounded-sm bg-[var(--g-line)] ring-1 ring-[var(--g-line)] md:grid-cols-3">
          {outlets.map((o) => (
            <li key={o.id} className="bg-white">
              <a href={o.url ?? '#'} target="_blank" rel="noopener" className="group flex h-full flex-col p-8 transition hover:bg-[var(--g-soft)]">
                <div className="flex h-[72px] items-center">
                  {o.logo ? <img src={o.logo} alt={o.name} className="max-h-[60px] max-w-[250px] object-contain" /> : <span className="text-[24px] font-extrabold">{o.name}</span>}
                </div>
                <p className="mt-6 text-[18px] font-bold tracking-[-0.02em]">{o.name}</p>
                <p className="mt-1.5 flex-1 text-[14.5px] leading-[1.7] text-[var(--g-sub)]">{o.intro}</p>
                <p className="mt-6 flex items-center gap-2 text-[13.5px] font-semibold text-[var(--g-navy)]">
                  홈페이지 바로가기 <span aria-hidden className="transition group-hover:translate-x-1">→</span>
                </p>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {/* 회원사 뉴스 + 공지 */}
      <section className="border-t border-[var(--g-line)] bg-[var(--g-soft)]">
        <div className="mx-auto grid grid-cols-1 max-w-[1200px] gap-14 px-4 py-20 md:py-24 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <div className="flex items-end justify-between">
              <div>
                <Eyebrow>NEWS</Eyebrow>
                <h2 className="mt-3 text-[26px] font-extrabold tracking-[-0.035em] text-[var(--g-navy)] md:text-[32px]">회원사 뉴스</h2>
              </div>
              <Link href={`${base}/news`} className="text-[14px] font-semibold text-[var(--g-navy)] hover:text-[var(--g-gold-ink)]">더보기 →</Link>
            </div>
            {lead ? (
              <div className="mt-8 grid gap-8 md:grid-cols-[1.25fr_1fr]">
                <a href={lead.url} target="_blank" rel="noopener" className="group block">
                  <div className="aspect-[16/10] overflow-hidden rounded-sm bg-[var(--g-navy)]">
                    {lead.thumb
                      ? <img src={lead.thumb} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                      : <span className="grid h-full place-items-center text-[18px] font-bold text-white/80">{lead.outlet}</span>}
                  </div>
                  <p className="mt-4 text-[12.5px] font-semibold tracking-[0.04em] text-[var(--g-gold-ink)]">{lead.outlet}</p>
                  <p className="mt-1 line-clamp-2 text-[21px] font-bold leading-[1.4] tracking-[-0.03em] group-hover:underline group-hover:decoration-[var(--g-gold)] group-hover:underline-offset-4">{lead.title}</p>
                  {lead.excerpt && <p className="mt-2 line-clamp-2 text-[14.5px] leading-[1.7] text-[var(--g-sub)]">{lead.excerpt}</p>}
                  <p className="mt-2 text-[12.5px] tabular-nums text-[var(--g-sub)]">{formatDate(lead.publishedAt)}</p>
                </a>
                <ul className="divide-y divide-[var(--g-line)] border-y border-[var(--g-line)]">
                  {rest.slice(0, 5).map((n) => (
                    <li key={n.id}>
                      <a href={n.url} target="_blank" rel="noopener" className="group flex gap-4 py-4">
                        <div className="h-[64px] w-[88px] shrink-0 overflow-hidden rounded-sm bg-[var(--g-navy)]">
                          {n.thumb ? <img src={n.thumb} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span className="grid h-full place-items-center px-1 text-center text-[10.5px] font-semibold leading-tight text-white/75">{n.outlet}</span>}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11.5px] font-semibold text-[var(--g-gold-ink)]">{n.outlet}</p>
                          <p className="mt-0.5 line-clamp-2 text-[15px] font-semibold leading-[1.45] group-hover:text-[var(--g-navy)] group-hover:underline group-hover:underline-offset-4">{n.title}</p>
                        </div>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="mt-8 rounded-sm bg-white py-16 text-center text-[14px] text-[var(--g-sub)]">회원사 기사가 곧 이곳에 모입니다.</p>
            )}
          </div>
          <aside>
            <div className="flex items-end justify-between">
              <div>
                <Eyebrow>NOTICE</Eyebrow>
                <h2 className="mt-3 text-[26px] font-extrabold tracking-[-0.035em] text-[var(--g-navy)] md:text-[32px]">공지사항</h2>
              </div>
              <Link href={`${base}/notice`} className="text-[14px] font-semibold text-[var(--g-navy)] hover:text-[var(--g-gold-ink)]">더보기 →</Link>
            </div>
            <ul className="mt-8 divide-y divide-[var(--g-line)] border-y border-[var(--g-line)]">
              {notices.items.map((p) => (
                <li key={p.id}>
                  <Link href={`${base}/notice/${p.id}`} className="group block py-4">
                    <p className="line-clamp-2 text-[15px] font-semibold leading-[1.5] group-hover:text-[var(--g-navy)] group-hover:underline group-hover:underline-offset-4">
                      {p.pinned && <span className="mr-1.5 rounded-sm bg-[var(--g-navy)] px-1.5 py-0.5 align-[2px] text-[11px] font-bold text-white">공지</span>}{p.title}
                    </p>
                    <p className="mt-1 text-[12.5px] tabular-nums text-[var(--g-sub)]">{formatDate(p.created_at)}</p>
                  </Link>
                </li>
              ))}
              {!notices.items.length && <li className="py-10 text-center text-[14px] text-[var(--g-sub)]">공지사항이 없습니다.</li>}
            </ul>
            <div className="mt-8 grid grid-cols-2 gap-3 text-[14px] font-semibold">
              <Link href={`${base}/data`} className="rounded-sm bg-white px-4 py-4 ring-1 ring-[var(--g-line)] hover:ring-[var(--g-navy)]">자료실 <span className="float-right text-[var(--g-gold-ink)]">→</span></Link>
              <Link href={`${base}/faq`} className="rounded-sm bg-white px-4 py-4 ring-1 ring-[var(--g-line)] hover:ring-[var(--g-navy)]">자주 묻는 질문 <span className="float-right text-[var(--g-gold-ink)]">→</span></Link>
            </div>
          </aside>
        </div>
      </section>

      {/* 가입 안내 */}
      <section className="relative isolate overflow-hidden bg-[var(--g-navy-d)] text-white">
        <img src="/gdpa/photos/seminar.jpg" alt="" loading="lazy" className="absolute inset-0 -z-10 h-full w-full object-cover opacity-40" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(8,28,51,.95)_0%,rgba(13,43,78,.75)_60%,rgba(13,43,78,.55)_100%)]" />
        <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-4 py-20 md:grid-cols-[1fr_auto] md:py-24">
          <div>
            <Eyebrow light>JOIN GDPA</Eyebrow>
            <h2 className="mt-4 text-balance text-[28px] font-extrabold leading-[1.35] tracking-[-0.035em] md:text-[38px]">더 넓은 언론의 연대에 함께해 주세요</h2>
            <p className="mt-4 max-w-[560px] text-[15.5px] leading-[1.8] text-white/75">언론사는 회원사로, 언론인과 관계자는 개인회원으로 가입할 수 있습니다. 사무국 승인 후 회원 전용 소식과 행사·교육 안내를 받습니다.</p>
          </div>
          <div className="flex flex-wrap gap-3 md:flex-col">
            <Link href={`${base}/members/join`} className="rounded-sm bg-[var(--g-gold)] px-8 py-4 text-center text-[15.5px] font-bold text-[var(--g-navy-d)] hover:brightness-110">회원사 입회 신청</Link>
            <Link href={`${base}/signup`} className="rounded-sm border border-white/40 px-8 py-4 text-center text-[15.5px] font-semibold hover:bg-white/10">개인 회원가입</Link>
          </div>
        </div>
      </section>
    </>
  )
}
