import Link from 'next/link'
import { after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCmsContext } from '@/lib/cms'
import { pressScope } from '@/lib/view-scope'
import { getT } from '@/lib/cms-t'
import { MANUAL_SOURCE, refreshPress } from '@/lib/press'
import { FOREIGN_TOPICS, NEWSWIRE_DAILY_FREE, PRESS_FIELDS, PRESS_SOURCES as ALL_SOURCES, fieldOfSource, foreignTopicOf, isUsSource, isRegionSection, pressHintsFromSections, REGIONS, regionOfSource, usableKeywords } from '@/lib/press-sources'
import { buildSite, hasPressTiers, type OutletRow } from '@/lib/sites'
import { formatDateTime, formatShort } from '@/lib/format'
import PendingButton from '@/components/cms/PendingButton'
import PressGroupBuilder, { type PickGroup } from '@/components/cms/PressGroupBuilder'
import PressBulkList, { type BulkRow } from '@/components/cms/PressBulkList'
import { refreshNow } from './actions'

// 정책브리핑 등 국내 사이트는 해외 접속을 막기도 하므로 서울 리전에서 가져온다
export const preferredRegion = 'icn1'
export const maxDuration = 60   // 보도자료 일괄 AI 기사 만들기(서버 동작)는 한 건에 30초 넘게 걸리기도 한다

const PAGE_SIZE = 30
// 맞춤 자료(그룹) 모드: 최근 14일 안의 자료만
const TIER_DAYS = 14
const TIER_SRC_DAYS = 30
const TIER_LEGACY_LIMIT = 3
type PressRow = { id: string; source_key: string; source_name: string; title: string; summary: string | null; link: string; published_at: string | null; mail_section?: string | null; tier?: number; kw?: string }

type Props = { searchParams: Promise<{ tab?: string; src?: string; q?: string; page?: string; msg?: string; s?: string | string[]; sec?: string; rg?: string }> }

function kstMidnightIso() {
  const kst = new Date(Date.now() + 9 * 3600e3)
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()) - 9 * 3600e3).toISOString()
}

export default async function PressPage(props: Props) {
  const searchParams = await props.searchParams
  const ctx = await getCmsContext()
  const { supabase, outletId } = ctx
  const { t, lang } = await getT()

  // 저장 공간 확인과 매체 설정은 함께 묻는다
  const [probe, { data: outlet }, { data: { session } }, { data: sectionRows }] = await Promise.all([
    supabase.from('press_fetch_log').select('source_key').limit(1),
    outletId ? supabase.from('outlets').select('*').eq('id', outletId).single() : Promise.resolve({ data: null }),
    supabase.auth.getSession(),
    outletId ? supabase.from('categories').select('name').eq('outlet_id', outletId) : Promise.resolve({ data: [] as { name: string }[] }),
  ])
  if (probe.error) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-10 md:px-8 md:py-16">
        <p className="rounded-lg border border-danger/30 bg-danger/5 px-5 py-4 text-[14px] text-danger">
          {lang === 'en' ? <>The press inbox storage has not been set up yet. Please run <code>supabase/press-releases.sql</code> in Supabase.</> : <>보도자료함 저장 공간이 아직 없습니다. Supabase에서 <code>supabase/press-releases.sql</code>을 실행해 주세요.</>}
        </p>
      </div>
    )
  }

  // 새 보도자료 받아 오기(바깥 사이트 여러 곳)는 화면을 먼저 보여준 뒤 뒤에서 한다 (기다리면 몇 초씩 걸린다)
  //   응답 뒤에는 로그인 쿠키를 못 읽으므로, 지금 로그인 토큰으로 같은 권한의 연결을 만든다
  const token = session?.access_token
  if (token) {
    after(() => refreshPress(createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })).catch(() => {}))
  }
  // 매체 홈페이지 설정의 '보도자료 추천 키워드' (없으면 추천 탭은 직접 등록·메일 자료만)
  const outletSite = outlet ? buildSite(outlet as OutletRow, []) : null
  // 추천 분야·키워드를 따로 정하지 않았으면 매체의 섹션 이름으로 알아서 정한다
  const sectionNames = ((sectionRows ?? []) as { name: string }[]).map((c) => c.name)
  const auto = outletSite && !outletSite.pressKeywords.length && !outletSite.pressFields.length ? pressHintsFromSections(sectionNames) : null
  const keywords = outletSite?.pressKeywords.length ? outletSite.pressKeywords : auto?.keywords ?? []
  // 해외 언론(영문) 자료는 매체 설정에서 켠 묶음만 본다 (이스라엘 언론 / 해외 교육·유학 언론)
  const topics = outletSite?.pressForeignTopics ?? []
  // 영문 매체(site.lang = en)는 미국(영문) 출처만, 한국어 매체는 미국 출처 없이 기존 출처만 본다
  const english = outletSite?.lang === 'en'
  const PRESS_SOURCES = ALL_SOURCES.filter((x) => english ? isUsSource(x.key) : !isUsSource(x.key) && (() => { const tp = foreignTopicOf(x.key); return !tp || topics.includes(tp) })())

  // 맞춤 자료로 고를 수 있는 출처: 한국어 매체는 미국 외 전부(해외 뉴스 포함), 영문 매체는 미국과 해외 뉴스. 고르기 전에는 아무것도 자동으로 들어가지 않는다
  const FEED_SOURCES = ALL_SOURCES.filter((x) => english ? isUsSource(x.key) || !!foreignTopicOf(x.key) : !isUsSource(x.key))

  const tab = searchParams.tab === 'all' ? 'all' : 'rec'
  // 전체 탭에서 체크한 출처 (체크한 출처의 자료만 보인다)
  const validSel = new Set([...FEED_SOURCES.map((x) => x.key), MANUAL_SOURCE, 'email'])
  const selected = tab === 'all' ? Array.from(new Set([searchParams.s ?? []].flat().map(String).filter((k) => validSel.has(k)))) : []
  const q = searchParams.q?.trim().slice(0, 50) || undefined
  const page = Math.max(1, Number(searchParams.page) || 1)

  // 전체 탭 목록: 체크한 출처가 있으면 그 출처만, 없으면 이 매체가 기본으로 보는 전체 (켜 둔 해외 묶음만)
  let query = supabase
    .from('press_releases')
    .select('id, source_key, source_name, title, summary, link, published_at, mail_section', { count: 'exact' })
    .order('published_at', { ascending: false, nullsFirst: false })
  // 보기 모드: 그 매체의 발행인·편집장·기자가 실제로 보는 자료만 (다른 그룹의 메일·직접 등록 자료는 뺀다)
  query = pressScope(query, ctx)
  if (selected.length) query = query.in('source_key', selected)
  else {
    if (english) query = query.or(`source_key.like.us-*,source_key.in.(${MANUAL_SOURCE},email)`)
    else query = query.not('source_key', 'like', 'us-%')
    if (!english) for (const ft of FOREIGN_TOPICS) if (!topics.includes(ft.key)) query = query.not('source_key', 'like', `${ft.prefix}%`)
  }
  if (q) query = query.ilike('title', `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)

  const fields = outletSite?.pressFields.length ? outletSite.pressFields : auto?.fields ?? []
  const fieldKeys = FEED_SOURCES.filter((x) => { const f = fieldOfSource(x.key); return !!f && fields.includes(f) }).map((x) => x.key)
  // 예전에 편집장이 ★로 골라 넣은 출처 (그룹에 담으면 여기서 빠진다)
  const pickedKeys = (outletSite?.pressSources ?? []).filter((k) => FEED_SOURCES.some((x) => x.key === k))
  const canPick = ctx.isEditorPlus || ctx.isStaff
  // 전체 탭 "맞춤 자료 만들기"에서 체크할 출처 묶음
  const toItems = (xs: typeof FEED_SOURCES): PickGroup['items'] => xs.map((x) => ({ key: x.key, name: x.name.replace('뉴스와이어 · ', ''), saved: pickedKeys.includes(x.key), auto: fieldKeys.includes(x.key) }))
  const pickGroups: PickGroup[] = [
    ...(english
      ? [
          { label: t('미국 · 지역·기관 소식', 'US · Local & institutions'), items: toItems(FEED_SOURCES.filter((x) => isUsSource(x.key) && x.local)) },
          { label: t('미국 · 전국 뉴스', 'US · National news'), items: toItems(FEED_SOURCES.filter((x) => isUsSource(x.key) && !x.local)) },
        ]
      : [
          ...PRESS_FIELDS.map((f) => ({ label: f.label, items: toItems(FEED_SOURCES.filter((x) => f.sources.includes(x.key))) })),
          // 중앙정부·공공기관 (지자체 묶음에 들지 않은 일반 출처)
          { label: t('정부·공공기관', 'Government & public agencies'), items: toItems(FEED_SOURCES.filter((x) => !fieldOfSource(x.key) && !foreignTopicOf(x.key) && !regionOfSource(x.key))) },
          // 지자체는 광역(특별시·광역시·도)별로 묶는다: 광역을 체크하면 아래 시·군·구가 모두 체크되고, 일부만 뺄 수 있다
          ...REGIONS.map((r) => ({ label: r.label, region: true, section: 'local' as const, items: toItems(r.sources.map((k) => FEED_SOURCES.find((x) => x.key === k)).filter((x): x is (typeof FEED_SOURCES)[number] => !!x)) })),
        ]),
    // 해외 뉴스 (미국 외): 나라·분야별로 묶는다
    ...FOREIGN_TOPICS.map((ft) => ({ label: ft.label, region: true, section: 'world' as const, items: toItems(FEED_SOURCES.filter((x) => x.key.startsWith(ft.prefix))) })),
  ].filter((g) => g.items.length > 0)
  pickGroups.unshift({ label: t('내가 넣은 자료', 'My own'), items: [{ key: 'email', name: t('메일', 'Email'), saved: false, auto: false }, { key: MANUAL_SOURCE, name: t('직접 등록', 'Added manually'), saved: false, auto: false }] })

  // 맞춤 자료 탭: 내가 그룹에 담은 것만 보인다 (자동으로 들어가는 자료는 없다)
  //   그룹 1→4 순서로, 그룹에 담은 키워드·출처마다 따로 최신 N건씩 가져와 합친다 (자료가 많은 곳이 다른 곳을 밀어내지 않게). 같은 자료는 앞 그룹에만 둔다
  //   예전에 ★로 넣은 출처는 맨 뒤에(출처당 3건) 둔다
  const tiers = outletSite?.pressTiers ?? []
  const tiered = tab === 'rec'
  const tierRows = async (): Promise<{ data: PressRow[]; count: number }> => {
    const sinceKw = new Date(Date.now() - TIER_DAYS * 86400e3).toISOString()
    const sinceSrc = new Date(Date.now() - TIER_SRC_DAYS * 86400e3).toISOString()
    const visible = new Set([...FEED_SOURCES.map((x) => x.key), 'email', MANUAL_SOURCE])
    const grouped = new Set(tiers.flatMap((g) => g.sources))
    type Block = { ti: number; limit: number; kws: string[]; srcs: string[] }
    const blocks: Block[] = [
      ...tiers.map((g, ti) => ({ ti, limit: g.limit, kws: usableKeywords(g.keywords), srcs: g.sources.filter((k) => visible.has(k)) })),
      { ti: 4, limit: TIER_LEGACY_LIMIT, kws: [], srcs: pickedKeys.filter((k) => !grouped.has(k)) },
    ]
    const cols = 'id, source_key, source_name, title, summary, link, published_at, mail_section'
    const win = (since: string) => `published_at.gte.${since},and(published_at.is.null,fetched_at.gte.${since})`
    const kwScope = english ? [`source_key.like.us-*`, ...FOREIGN_TOPICS.map((ft) => `source_key.like.${ft.prefix}*`), `source_key.in.(${MANUAL_SOURCE},email)`].join(',') : null
    const jobs: (() => Promise<PressRow[]>)[] = []
    for (const b of blocks) {
      for (const k of b.kws) jobs.push(async () => {
        let qy = pressScope(supabase.from('press_releases').select(cols), ctx)
        qy = kwScope ? qy.or(kwScope) : qy.not('source_key', 'like', 'us-%')
        const { data } = await qy.or(`title.ilike.*${k}*,summary.ilike.*${k}*`).or(win(sinceKw)).order('published_at', { ascending: false, nullsFirst: false }).limit(b.limit)
        return ((data ?? []) as PressRow[]).map((r) => ({ ...r, tier: b.ti, kw: k }))
      })
      for (const key of b.srcs) jobs.push(async () => {
        const { data } = await pressScope(supabase.from('press_releases').select(cols), ctx).eq('source_key', key).or(win(sinceSrc)).order('published_at', { ascending: false, nullsFirst: false }).limit(b.limit)
        return ((data ?? []) as PressRow[]).map((r) => ({ ...r, tier: b.ti }))
      })
    }
    // 출처가 많아도 한꺼번에 수십 개를 보내지 않게 25개씩 나눠 가져온다
    const results: PressRow[][] = []
    for (let i = 0; i < jobs.length; i += 25) results.push(...await Promise.all(jobs.slice(i, i + 25).map((j) => j())))
    const seen = new Set<string>()
    const merged = results.flat().filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
    return { data: merged, count: merged.length }
  }
  const hasFeed = hasPressTiers(tiers) || pickedKeys.length > 0

  const [{ data: rowsRaw, count }, { data: logs }, { data: todayUses }] = await Promise.all([
    tiered ? (hasFeed ? tierRows() : Promise.resolve({ data: [] as PressRow[], count: 0 })) : query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.from('press_fetch_log').select('*'),
    outletId
      ? supabase.from('articles').select('id, press_release:press_releases(source_key)').eq('outlet_id', outletId).not('press_release_id', 'is', null).gte('created_at', kstMidnightIso())
      : Promise.resolve({ data: [] as any[] }),
  ])

  const allRowsFull = (rowsRaw ?? []) as PressRow[]
  // 맞춤 자료 탭의 제목 검색: 이미 모은 자료 안에서 거른다
  const allRows = tiered && q ? allRowsFull.filter((r) => r.title.toLowerCase().includes(q.toLowerCase())) : allRowsFull
  // 맞춤 자료의 지역별 보기: 담은 출처가 어느 광역(특별시·광역시·도)인지, 해외 뉴스인지, 그 밖인지로 나눠 보여 준다
  const regionKeyOf = (key: string) => regionOfSource(key) ?? (key === 'email' || key === MANUAL_SOURCE ? 'own' : foreignTopicOf(key) || isUsSource(key) ? 'world' : 'etc')
  const REGION_CHIPS = [
    ...REGIONS.map((r) => ({ key: r.key, label: r.label })),
    { key: 'world', label: t('해외 뉴스', 'World news') },
    { key: 'etc', label: t('정부·공공기관·분야', 'Government & fields') },
    { key: 'own', label: t('내가 넣은 자료', 'My own') },
  ]
  const regionCounts = new Map<string, number>()
  for (const r of allRows) regionCounts.set(regionKeyOf(r.source_key), (regionCounts.get(regionKeyOf(r.source_key)) ?? 0) + 1)
  const rgSel = tiered && hasFeed && REGION_CHIPS.some((c) => c.key === searchParams.rg && (regionCounts.get(c.key) ?? 0) > 0) ? String(searchParams.rg) : ''
  const rows = rgSel ? allRows.filter((r) => regionKeyOf(r.source_key) === rgSel) : allRows
  const ids = rows.map((r) => r.id)
  const { data: used } = ids.length && outletId
    ? await supabase.from('articles').select('press_release_id').eq('outlet_id', outletId).in('press_release_id', ids)
    : { data: [] as { press_release_id: string }[] }
  const usedSet = new Set((used ?? []).map((u) => u.press_release_id))
  const newswireToday = (todayUses ?? []).filter((a: any) => a.press_release?.source_key?.startsWith('nw-')).length
  const logByKey = new Map((logs ?? []).map((l) => [l.source_key as string, l]))
  const pages = tiered ? 1 : Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))
  // 수집 실패 이유는 한국어로 저장되므로, 영어 화면에서는 보여 줄 때 바꾼다
  const failText = (m: string | null) => lang === 'en' ? (m === '응답 시간 초과' ? 'Response timed out' : m === '알 수 없는 오류' ? 'Unknown error' : m) : m

  const href = (p: Record<string, string | undefined>) => {
    const sp = new URLSearchParams()
    Object.entries({ tab: tab === 'all' ? 'all' : undefined, q, ...p }).forEach(([k, v]) => v && sp.set(k, v))
    if (tab === 'all') selected.forEach((k) => sp.append('s', k))
    const s = sp.toString()
    return `/press${s ? `?${s}` : ''}`
  }

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-5 md:px-8 md:py-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 md:mb-6 md:gap-4">
        <div>
          <h1 className="text-[22px] font-bold tracking-tight">{t('보도자료함', 'Press releases')}</h1>
          <p className="mt-1 text-[13px] text-muted">{t('정부·기관·기업 보도자료를 30분마다 자동으로 모읍니다. 내 메일로 온 보도자료도 “메일로 받기”를 설정하면 자동으로 들어옵니다(프리미엄 포함, 베이직·스탠다드는 부가 서비스).', 'Press releases from government agencies, institutions, and companies are collected automatically every 30 minutes. Press releases sent to your own email also arrive automatically once you set up “Receive by email” (included with Premium; an add-on for Basic and Standard).')}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/press/email" className="btn-secondary bg-white">{t('✉ 메일로 받기 설정', '✉ Email setup')}</Link>
          <Link href="/press/new" className="btn-primary">{t('+ 직접 등록', '+ Add manually')}</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0 rounded-lg border border-line bg-white">
          <div className="flex flex-wrap items-center justify-between gap-x-3 border-b border-line px-2 md:px-5">
            <nav className="flex max-w-full overflow-x-auto" aria-label={t('보기', 'View')}>
              {[
                { key: 'rec', label: lang === 'en' ? `My feed (${outlet?.name ?? 'outlet'})` : `맞춤 자료 (${outlet?.name ?? '매체'})` },
                { key: 'all', label: t('전체', 'All') },
              ].map((tb) => (
                <Link
                  key={tb.key}
                  href={href({ tab: tb.key === 'all' ? 'all' : undefined, page: undefined })}
                  aria-current={tab === tb.key ? 'page' : undefined}
                  className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-2.5 py-3.5 text-[14px] md:px-4 ${tab === tb.key ? 'border-ink font-bold text-ink' : 'border-transparent text-muted hover:text-ink'}`}
                >
                  {tb.label}
                </Link>
              ))}
            </nav>
            <form action="/press" className="flex w-full items-center gap-2 px-2 py-2 md:w-auto md:px-0">
              {tab === 'all' && <input type="hidden" name="tab" value="all" />}
              {selected.map((k) => <input key={k} type="hidden" name="s" value={k} />)}
              <label htmlFor="press-q" className="sr-only">{t('제목 검색', 'Search titles')}</label>
              <input id="press-q" name="q" defaultValue={q} placeholder={t('제목 검색', 'Search titles')} className="field-input h-9 min-w-0 flex-1 py-1.5 md:w-52 md:flex-none" />
              <button type="submit" className="btn-secondary h-9 py-1.5">{t('검색', 'Search')}</button>
            </form>
          </div>

          {tab === 'all' && pickGroups.length > 0 && (
            <PressGroupBuilder
              outletId={outletId}
              canPick={canPick}
              initial={tiers}
              groups={pickGroups}
              selected={selected}
              q={q}
              suggestions={Array.from(new Set([...sectionNames, ...keywords])).slice(0, 40)}
            />
          )}
          {searchParams.msg && <p className="border-b border-line bg-[#FFF8E6] px-4 py-2.5 text-[12.5px] text-[#6B4E00] md:px-5">{searchParams.msg.slice(0, 200)}</p>}

          {tiered && hasFeed && (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-line bg-[#F1F6FF] px-4 py-2.5 text-[12.5px] text-[#27456F] md:px-5">
              <span className="mr-1 font-semibold">{t('지역별로 보기', 'View by region')}</span>
              {[{ key: '', label: t('모두', 'All') }, ...REGION_CHIPS.filter((c) => (regionCounts.get(c.key) ?? 0) > 0)].map((c) => (
                <Link key={c.key || 'all'} href={c.key ? `/press?rg=${c.key}` : '/press'} aria-current={rgSel === c.key ? 'true' : undefined} className={`rounded-full border px-3 py-1 text-[12px] ${rgSel === c.key ? 'border-ink bg-ink text-white' : 'border-[#27456F]/30 bg-white text-[#27456F] hover:border-ink'}`}>
                  {c.label} <span className="tabular-nums opacity-70">{c.key ? regionCounts.get(c.key) : allRows.length}</span>
                </Link>
              ))}
              <span className="ml-1 text-[#27456F]/80">{t('맞춤 자료는 “전체” 탭에서 정합니다.', 'Set up My feed in the “All” tab.')}</span>
            </div>
          )}
          {tab === 'rec' && !hasFeed && (
            <div className="border-b border-line bg-[#FFF8E6] px-4 py-4 text-[13px] leading-relaxed text-[#6B4E00] md:px-5">
              <p className="font-semibold">{t('아직 고른 자료가 없습니다.', 'Nothing selected yet.')}</p>
              <p className="mt-0.5">{t('맞춤 자료에는 자동으로 들어오는 자료가 없고, 내가 고른 것만 보입니다. ', 'My feed has no automatic items; it shows only what you pick. ')}{canPick
                ? <Link href="/press?tab=all" className="font-semibold underline">{t('“전체” 탭에서 그룹을 만들어 출처를 담아 보세요', 'Build your groups in the “All” tab')}</Link>
                : t('편집장에게 “전체” 탭에서 맞춤 자료를 만들어 달라고 요청하세요.', 'Ask your editor to build My feed in the “All” tab.')}</p>
            </div>
          )}
          {rows.length ? (
            <PressBulkList rows={rows.map((r, i): BulkRow => ({
              id: r.id,
              title: r.title,
              summary: r.summary,
              sourceName: r.source_name,
              date: formatShort(r.published_at, lang),
              dateIso: r.published_at,
              used: usedSet.has(r.id),
              badges: [
                ...(r.source_key === MANUAL_SOURCE ? [t('직접 등록', 'Added manually')] : []),
                ...(r.source_key === 'email' ? [t('메일', 'Email'), ...(r.mail_section ? [r.mail_section] : [])] : []),
                ...(tiered && r.kw ? [r.kw] : []),
              ],
              head: tiered && (i === 0 || rows[i - 1].tier !== r.tier)
                ? (r.tier === 4
                  ? t(`그룹 없이 넣은 출처(★) · 출처당 최신 ${TIER_LEGACY_LIMIT}건`, `Sources added without a group (★) · latest ${TIER_LEGACY_LIMIT} per source`)
                  : t(`그룹 ${(r.tier ?? 0) + 1} · 키워드·출처당 최신 ${tiers[r.tier ?? 0]?.limit}건`, `Group ${(r.tier ?? 0) + 1} · latest ${tiers[r.tier ?? 0]?.limit} per keyword/source`))
                : null,
            }))} />
          ) : (
            <p className="px-5 py-20 text-center text-[14px] text-muted">
              {q ? (lang === 'en' ? `No press releases match ‘${q}’.` : `‘${q}’에 해당하는 보도자료가 없습니다.`) : tab === 'rec' ? (hasFeed ? t('고른 그룹에 해당하는 최근 보도자료가 아직 없습니다.', 'No recent releases match your groups yet.') : '') : t('아직 가져온 보도자료가 없습니다.', 'No press releases have been collected yet.')}
            </p>
          )}

          {pages > 1 && (
            <nav className="flex flex-wrap justify-center gap-1 border-t border-line px-5 py-4" aria-label={t('페이지', 'Pages')}>
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
          {!english && <section className={`rounded-lg border px-5 py-4 ${newswireToday >= NEWSWIRE_DAILY_FREE ? 'border-danger/40 bg-danger/5' : 'border-line bg-white'}`}>
            <h2 className="text-[14px] font-bold">{t('오늘 뉴스와이어 기사화', 'Newswire stories created today')}</h2>
            <p className="mt-1 text-[26px] font-bold tabular-nums">
              {newswireToday}<span className="text-[15px] font-medium text-muted"> / {NEWSWIRE_DAILY_FREE}{t('건', '')}</span>
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted">
              {lang === 'en' ? `To use more than ${NEWSWIRE_DAILY_FREE} Newswire press releases per day, an outlet needs Newswire's prior permission.` : `뉴스와이어 보도자료는 언론사가 하루 ${NEWSWIRE_DAILY_FREE}건을 넘게 쓰려면 뉴스와이어의 사전 허락이 필요합니다.`}
            </p>
          </section>}

          <section className="rounded-lg border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <h2 className="text-[14px] font-bold">{t('출처별 수집 상태', 'Collection status by source')}</h2>
              <form action={refreshNow}>
                <PendingButton pending={t('가져오는 중…', 'Fetching…')} className="btn-secondary px-3 py-1.5 text-[12px]">{t('지금 가져오기', 'Fetch now')}</PendingButton>
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
                      {l?.ok && <span className="tabular-nums text-muted">{lang === 'en' ? l.item_count : `${l.item_count}건`}</span>}
                    </div>
                    <p className="ml-4 mt-0.5 text-[11.5px] text-muted">
                      {!l ? t('아직 가져오지 않음', 'Not fetched yet') : l.ok ? (lang === 'en' ? `Collected ${formatDateTime(l.fetched_at, lang)}` : `${formatDateTime(l.fetched_at)} 수집`) : `${t('실패', 'Failed')}: ${failText(l.message)}`}
                    </p>
                  </li>
                )
              })}
            </ul>
            <p className="border-t border-line px-5 py-3 text-[11.5px] leading-relaxed text-muted">{t('30분마다 자동으로 가져옵니다(press-cron.sql 실행 시). 보도자료함을 열 때도 10분이 지난 출처는 다시 가져옵니다.', 'Sources are fetched automatically every 30 minutes (when press-cron.sql has been run). Sources not updated in the last 10 minutes are also re-fetched when you open the press inbox.')}</p>
          </section>
        </aside>
      </div>
    </div>
  )
}
