import Link from 'next/link'
import { getCmsContext } from '@/lib/cms'
import { MANUAL_SOURCE, refreshPress } from '@/lib/press'
import { FOREIGN_TOPICS, NEWSWIRE_DAILY_FREE, PRESS_SOURCES as ALL_SOURCES, fieldOfSource, foreignTopicOf, usableKeywords } from '@/lib/press-sources'
import { buildSite, type OutletRow } from '@/lib/sites'
import { formatDateTime, formatShort } from '@/lib/format'
import PendingButton from '@/components/cms/PendingButton'
import { refreshNow } from './actions'

// 정책브리핑 등 국내 사이트는 해외 접속을 막기도 하므로 서울 리전에서 가져온다
export const preferredRegion = 'icn1'
export const maxDuration = 30

const PAGE_SIZE = 30

type Props = { searchParams: Promise<{ tab?: string; src?: string; q?: string; page?: string }> }

function kstMidnightIso() {
  const kst = new Date(Date.now() + 9 * 3600e3)
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9 * 3600e3).toISOString()
}

export default async function PressPage(props: Props) {
  const searchParams = await props.searchParams
  const { supabase, outletId } = await getCmsContext()

  const probe = await supabase.from('press_fetch_log').select('source_key').limit(1)
  if (probe.error) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-10 md:px-8 md:py-16">
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-5 py-4 text-[14px] text-danger">
          보도자료함 저장 공간이 아직 없습니다. Supabase에서 <code>supabase/press-releases.sql</code>을 실행해 주세요.
        </p>
      </div>
    )
  }

  await refreshPress(supabase)

  const { data: outlet } = outletId ? await supabase.from('outlets').select('*').eq('id', outletId).single() : { data: null }
  // 매체 홈페이지 설정의 '보도자료 추천 키워드' (없으면 추천 탭은 직접 등록·메일 자료만)
  const outletSite = outlet ? buildSite(outlet as OutletRow, []) : null
  const keywords = outletSite?.pressKeywords ?? []
  // 해외 언론(영문) 자료는 매체 설정에서 켠 묶음만 본다 (이스라엘 언론 / 해외 교육·유학 언론)
  const topics = outletSite?.pressForeignTopics ?? []
  const PRESS_SOURCES = ALL_SOURCES.filter((x) => { const t = foreignTopicOf(x.key); return !t || topics.includes(t) })

  const tab = searchParams.tab === 'all' ? 'all' : 'rec'
  const src = searchParams.src === MANUAL_SOURCE || searchParams.src === 'email' ? searchParams.src : PRESS_SOURCES.find((s) => s.key === searchParams.src)?.key
  const q = searchParams.q?.trim().slice(0, 50) || undefined
  const page = Math.max(1, Number(searchParams.page) || 1)

  let query = supabase
    .from('press_releases')
    .select('id, source_key, source_name, title, summary, link, published_at', { count: 'exact' })
    .order('published_at', { ascending: false, nullsFirst: false })
  if (src) query = query.eq('source_key', src)
  for (const t of FOREIGN_TOPICS) if (!topics.includes(t.key)) query = query.not('source_key', 'like', `${t.prefix}%`)
  if (q) query = query.ilike('title', `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)
  // 추천 탭: 매체 분야(예: 교육)의 출처 + 켠 해외 언론 + 메일·직접 등록 + 정부·공공기관 자료 중 제목에 추천 키워드가 있는 것
  //   분야를 정하지 않은 매체는 예전처럼 제목에 추천 키워드가 있는 자료 (짧은 영문 약어는 엉뚱한 단어에 걸려 뺀다)
  const fields = outletSite?.pressFields ?? []
  const kw = usableKeywords(keywords)
  const titleHit = kw.map((k) => `title.ilike.*${k}*`)
  const foreignKeys = PRESS_SOURCES.filter((x) => foreignTopicOf(x.key)).map((x) => x.key)
  const fieldKeys = PRESS_SOURCES.filter((x) => { const f = fieldOfSource(x.key); return !!f && fields.includes(f) }).map((x) => x.key)
  const generalKeys = PRESS_SOURCES.filter((x) => !fieldOfSource(x.key) && !foreignTopicOf(x.key)).map((x) => x.key)
  const recBase = [MANUAL_SOURCE, 'email', ...foreignKeys, ...fieldKeys]
  // 추천 탭 위 출처 버튼: 분야를 정한 매체는 추천에 들어오는 출처만
  const recSources = fields.length ? new Set([...fieldKeys, ...foreignKeys, ...(titleHit.length ? generalKeys : [])]) : null
  if (tab === 'rec' && fields.length) {
    query = query.or([`source_key.in.(${recBase.join(',')})`, ...(titleHit.length && generalKeys.length ? [`and(source_key.in.(${generalKeys.join(',')}),or(${titleHit.join(',')}))`] : [])].join(','))
  } else if (tab === 'rec' && titleHit.length) {
    query = query.or([`source_key.in.(${recBase.filter((k) => !fieldOfSource(k)).join(',')})`, ...titleHit].join(','))
  }

  const [{ data: rows, count }, { data: logs }, { data: todayUses }] = await Promise.all([
    query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.from('press_fetch_log').select('*'),
    outletId
      ? supabase.from('articles').select('id, press_release:press_releases(source_key)').eq('outlet_id', outletId).not('press_release_id', 'is', null).gte('created_at', kstMidnightIso())
      : Promise.resolve({ data: [] as any[] }),
  ])

  const ids = (rows ?? []).map((r) => r.id)
  const { data: used } = ids.length && outletId
    ? await supabase.from('articles').select('press_release_id').eq('outlet_id', outletId).in('press_release_id', ids)
    : { data: [] as { press_release_id: string }[] }
  const usedSet = new Set((used ?? []).map((u) => u.press_release_id))
  const newswireToday = (todayUses ?? []).filter((a: any) => a.press_release?.source_key?.startsWith('nw-')).length
  const logByKey = new Map((logs ?? []).map((l) => [l.source_key as string, l]))
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))

  const href = (p: Record<string, string | undefined>) => {
    const sp = new URLSearchParams()
    Object.entries({ tab: tab === 'all' ? 'all' : undefined, src, q, ...p }).forEach(([k, v]) => v && sp.set(k, v))
    const s = sp.toString()
    return `/press${s ? `?${s}` : ''}`
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-5 md:px-8 md:py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 md:mb-6 md:gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">보도자료함</h1>
          <p className="mt-1 text-[13px] text-muted">정부·기관·기업 보도자료를 30분마다 자동으로 모읍니다. 내 메일로 온 보도자료도 “메일로 받기”를 설정하면 자동으로 들어옵니다.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/press/email" className="btn-secondary bg-white">✉ 메일로 받기 설정</Link>
          <Link href="/press/new" className="btn-primary">+ 직접 등록</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0 rounded-lg border border-line bg-white">
          <div className="flex flex-wrap items-center justify-between gap-x-3 border-b border-line px-2 md:px-5">
            <nav className="flex max-w-full overflow-x-auto" aria-label="보기">
              {[
                { key: 'rec', label: `추천 (${outlet?.name ?? '매체'} 관련)` },
                { key: 'all', label: '전체' },
              ].map((t) => (
                <Link
                  key={t.key}
                  href={href({ tab: t.key === 'all' ? 'all' : undefined, page: undefined })}
                  aria-current={tab === t.key ? 'page' : undefined}
                  className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-2.5 py-3.5 text-[14px] md:px-4 ${tab === t.key ? 'border-ink font-bold text-ink' : 'border-transparent text-muted hover:text-ink'}`}
                >
                  {t.label}
                </Link>
              ))}
            </nav>
            <form action="/press" className="flex w-full items-center gap-2 px-2 py-2 md:w-auto md:px-0">
              {tab === 'all' && <input type="hidden" name="tab" value="all" />}
              {src && <input type="hidden" name="src" value={src} />}
              <label htmlFor="press-q" className="sr-only">제목 검색</label>
              <input id="press-q" name="q" defaultValue={q} placeholder="제목 검색" className="field-input h-9 min-w-0 flex-1 py-1.5 md:w-52 md:flex-none" />
              <button type="submit" className="btn-secondary h-9 py-1.5">검색</button>
            </form>
          </div>

          <div className="flex gap-1.5 overflow-x-auto border-b border-line px-4 py-3 md:flex-wrap md:px-5 [&>a]:shrink-0 [&>a]:whitespace-nowrap">
            <Link href={href({ src: undefined, page: undefined })} className={`rounded-full border px-3 py-1 text-[12px] ${!src ? 'border-ink bg-ink text-white' : 'border-line text-muted hover:border-ink hover:text-ink'}`}>모든 출처</Link>
            <Link href={href({ src: 'email', page: undefined })} className={`rounded-full border px-3 py-1 text-[12px] ${src === 'email' ? 'border-ink bg-ink text-white' : 'border-line text-muted hover:border-ink hover:text-ink'}`}>메일</Link>
            <Link href={href({ src: MANUAL_SOURCE, page: undefined })} className={`rounded-full border px-3 py-1 text-[12px] ${src === MANUAL_SOURCE ? 'border-ink bg-ink text-white' : 'border-line text-muted hover:border-ink hover:text-ink'}`}>직접 등록</Link>
            {PRESS_SOURCES.filter((s) => tab === 'all' || !recSources || recSources.has(s.key)).map((s) => (
              <Link key={s.key} href={href({ src: s.key, page: undefined })} className={`rounded-full border px-3 py-1 text-[12px] ${src === s.key ? 'border-ink bg-ink text-white' : 'border-line text-muted hover:border-ink hover:text-ink'}`}>
                {s.name.replace('뉴스와이어 · ', '')}
              </Link>
            ))}
          </div>

          {rows?.length ? (
            <ul className="divide-y divide-line">
              {rows.map((r) => (
                <li key={r.id}>
                  <Link href={`/press/${r.id}`} className="block px-4 py-4 hover:bg-[#F8F9FA] md:px-5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted">
                      {r.source_key === MANUAL_SOURCE && <span className="rounded bg-ink px-1.5 py-0.5 text-white">직접 등록</span>}
                      {r.source_key === 'email' && <span className="rounded bg-review px-1.5 py-0.5 text-white">메일</span>}
                      <span className="rounded bg-line/70 px-1.5 py-0.5">{r.source_name}</span>
                      <time className="tabular-nums" dateTime={r.published_at ?? undefined}>{formatShort(r.published_at)}</time>
                      {usedSet.has(r.id) && <span className="rounded bg-published/10 px-1.5 py-0.5 font-semibold text-published">기사화됨</span>}
                    </div>
                    <p className="mt-1.5 text-[15px] font-semibold leading-snug">{r.title}</p>
                    {r.summary && <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">{r.summary}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-20 text-center text-[14px] text-muted">
              {q ? `‘${q}’에 해당하는 보도자료가 없습니다.` : tab === 'rec' ? '관련 키워드에 맞는 보도자료가 아직 없습니다. “전체” 탭도 확인해 보세요.' : '아직 가져온 보도자료가 없습니다.'}
            </p>
          )}

          {pages > 1 && (
            <nav className="flex flex-wrap justify-center gap-1 border-t border-line px-5 py-4" aria-label="페이지">
              {Array.from({ length: Math.min(pages, 10) }, (_, i) => i + 1).map((p) => (
                <Link key={p} href={href({ page: p > 1 ? String(p) : undefined })} aria-current={p === page ? 'page' : undefined}
                  className={`grid h-8 min-w-8 place-items-center rounded border px-2 text-[12.5px] tabular-nums ${p === page ? 'border-ink bg-ink text-white' : 'border-line hover:border-ink'}`}>
                  {p}
                </Link>
              ))}
            </nav>
          )}
        </section>

        <aside className="space-y-5">
          <section className={`rounded-lg border px-5 py-4 ${newswireToday >= NEWSWIRE_DAILY_FREE ? 'border-danger/40 bg-danger/5' : 'border-line bg-white'}`}>
            <h2 className="text-[14px] font-bold">오늘 뉴스와이어 기사화</h2>
            <p className="mt-1 text-[26px] font-bold tabular-nums">
              {newswireToday}<span className="text-[15px] font-medium text-muted"> / {NEWSWIRE_DAILY_FREE}건</span>
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              뉴스와이어 보도자료는 언론사가 하루 {NEWSWIRE_DAILY_FREE}건을 넘게 쓰려면 뉴스와이어의 사전 허락이 필요합니다.
            </p>
          </section>

          <section className="rounded-lg border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="text-[14px] font-bold">출처별 수집 상태</h2>
              <form action={refreshNow}>
                <PendingButton pending="가져오는 중…" className="btn-secondary px-3 py-1.5 text-[12px]">지금 가져오기</PendingButton>
              </form>
            </div>
            <ul className="divide-y divide-line">
              {PRESS_SOURCES.map((s) => {
                const l = logByKey.get(s.key)
                return (
                  <li key={s.key} className="px-5 py-2.5 text-[12.5px]">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 shrink-0 rounded-full ${!l ? 'bg-line' : l.ok ? 'bg-published' : 'bg-danger'}`} aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{s.name}</span>
                      {l?.ok && <span className="tabular-nums text-muted">{l.item_count}건</span>}
                    </div>
                    <p className="ml-4 mt-0.5 text-[11.5px] text-muted">
                      {!l ? '아직 가져오지 않음' : l.ok ? `${formatDateTime(l.fetched_at)} 수집` : `실패: ${l.message}`}
                    </p>
                  </li>
                )
              })}
            </ul>
            <p className="border-t border-line px-5 py-3 text-[11.5px] leading-relaxed text-muted">30분마다 자동으로 가져옵니다(press-cron.sql 실행 시). 보도자료함을 열 때도 10분이 지난 출처는 다시 가져옵니다.</p>
          </section>
        </aside>
      </div>
    </div>
  )
}
