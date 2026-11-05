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
import PressSourceFilter, { type PickGroup } from '@/components/cms/PressSourceFilter'
import PressTierSettings from '@/components/cms/PressTierSettings'
import { refreshNow, savePressSources, savePressTierSources } from './actions'

// 정책브리핑 등 국내 사이트는 해외 접속을 막기도 하므로 서울 리전에서 가져온다
export const preferredRegion = 'icn1'
export const maxDuration = 30

const PAGE_SIZE = 30
// 맞춤 자료(그룹) 모드: 최근 14일 안의 자료만
const TIER_DAYS = 14
const TIER_SRC_DAYS = 30
const TIER_OWN_LIMIT = 10
const TIER_LEGACY_LIMIT = 3
type PressRow = { id: string; source_key: string; source_name: string; title: string; summary: string | null; link: string; published_at: string | null; tier?: number; kw?: string }

type Props = { searchParams: Promise<{ tab?: string; src?: string; q?: string; page?: string; msg?: string; s?: string | string[]; sec?: string }> }

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

  const tab = searchParams.tab === 'all' ? 'all' : 'rec'
  const src = searchParams.src === MANUAL_SOURCE || searchParams.src === 'email' ? searchParams.src : PRESS_SOURCES.find((s) => s.key === searchParams.src)?.key
  // 전체 탭에서 체크한 출처 (체크한 출처의 자료만 보인다)
  const validSel = new Set([...PRESS_SOURCES.map((x) => x.key), MANUAL_SOURCE, 'email'])
  const selected = tab === 'all' ? Array.from(new Set([searchParams.s ?? []].flat().map(String).filter((k) => validSel.has(k)))) : []
  // 이 매체의 섹션: 맞춤 자료 위에 고정 버튼으로 보이고, 누르면 그 섹션 이름에서 나온 단어가 제목에 있는 자료만 본다
  const sectionPills = Array.from(new Set(sectionNames.map((n) => n.trim()).filter(Boolean))).map((name) => { const kws = pressHintsFromSections([name]).keywords; return { name, kws: kws.length ? kws : isRegionSection(name) ? [name] : [] } }).filter((x) => x.kws.length > 0)
  const sec = tab === 'rec' ? sectionPills.find((x) => x.name === searchParams.sec) : undefined
  const q = searchParams.q?.trim().slice(0, 50) || undefined
  const page = Math.max(1, Number(searchParams.page) || 1)

  let query = supabase
    .from('press_releases')
    .select('id, source_key, source_name, title, summary, link, published_at', { count: 'exact' })
    .order('published_at', { ascending: false, nullsFirst: false })
  // 보기 모드: 그 매체의 발행인·편집장·기자가 실제로 보는 자료만 (다른 그룹의 메일·직접 등록 자료는 뺀다)
  query = pressScope(query, ctx)
  if (src) query = query.eq('source_key', src)
  // 섹션 버튼은 자동으로 고른 자료만 거르고, 메일·직접 등록 자료는 그대로 둔다
  if (sec) query = query.or([`source_key.in.(${MANUAL_SOURCE},email)`, ...usableKeywords(sec.kws).map((k) => `title.ilike.*${k}*`)].join(','))
  else if (selected.length) query = query.in('source_key', selected)
  if (english) query = query.or(`source_key.like.us-*,source_key.in.(${MANUAL_SOURCE},email)`)
  else query = query.not('source_key', 'like', 'us-%')
  if (!english) for (const ft of FOREIGN_TOPICS) if (!topics.includes(ft.key)) query = query.not('source_key', 'like', `${ft.prefix}%`)
  if (q) query = query.ilike('title', `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`)
  // 추천 탭: 매체 분야(예: 교육)의 출처 + 켠 해외 언론 + 메일·직접 등록 + 정부·공공기관 자료 중 제목에 추천 키워드가 있는 것
  //   분야를 정하지 않은 매체는 예전처럼 제목에 추천 키워드가 있는 자료 (짧은 영문 약어는 엉뚱한 단어에 걸려 뺀다)
  const fields = outletSite?.pressFields.length ? outletSite.pressFields : auto?.fields ?? []
  const kw = usableKeywords(keywords)
  const titleHit = kw.map((k) => `title.ilike.*${k}*`)
  const foreignKeys = PRESS_SOURCES.filter((x) => foreignTopicOf(x.key)).map((x) => x.key)
  const fieldKeys = PRESS_SOURCES.filter((x) => { const f = fieldOfSource(x.key); return !!f && fields.includes(f) }).map((x) => x.key)
  const generalKeys = PRESS_SOURCES.filter((x) => !fieldOfSource(x.key) && !foreignTopicOf(x.key)).map((x) => x.key)
  // 편집장이 전체 탭에서 직접 골라 넣은 출처 (이 매체가 볼 수 있는 출처만)
  const pickedKeys = (outletSite?.pressSources ?? []).filter((k) => PRESS_SOURCES.some((x) => x.key === k))
  const recBase = Array.from(new Set([MANUAL_SOURCE, 'email', ...foreignKeys, ...fieldKeys, ...pickedKeys]))
  const canPick = ctx.isEditorPlus || ctx.isStaff
  const usLocal = Array.from(new Set([...PRESS_SOURCES.filter((x) => x.local).map((x) => x.key), ...pickedKeys]))
  const usWire = PRESS_SOURCES.filter((x) => !x.local && !pickedKeys.includes(x.key)).map((x) => x.key)
  // 전체 탭 "맞춤 자료 만들기"에서 체크할 출처 묶음 (이 매체가 볼 수 있는 출처만, 해외 언론 묶음은 매체 설정에서 켜므로 뺀다)
  const tierOf = new Map<string, number>((outletSite?.pressTiers ?? []).flatMap((g, i) => g.sources.map((k) => [k, i + 1] as [string, number])))
  const toItems = (xs: typeof PRESS_SOURCES): PickGroup['items'] => xs.map((x) => ({ key: x.key, name: x.name.replace('뉴스와이어 · ', ''), saved: pickedKeys.includes(x.key), auto: fieldKeys.includes(x.key), tier: tierOf.get(x.key) }))
  const pickGroups: PickGroup[] = (english
    ? [
        { label: t('지역·기관 소식', 'Local & institutions'), items: toItems(PRESS_SOURCES.filter((x) => x.local)) },
        { label: t('전국 뉴스', 'National news'), items: toItems(PRESS_SOURCES.filter((x) => !x.local)) },
      ]
    : [
        ...PRESS_FIELDS.map((f) => ({ label: f.label, items: toItems(PRESS_SOURCES.filter((x) => f.sources.includes(x.key))) })),
        // 중앙정부·공공기관 (지자체 묶음에 들지 않은 일반 출처)
        { label: t('정부·공공기관', 'Government & public agencies'), items: toItems(PRESS_SOURCES.filter((x) => !fieldOfSource(x.key) && !foreignTopicOf(x.key) && !regionOfSource(x.key))) },
        // 지자체는 광역(특별시·광역시·도)별로 묶는다: 광역을 체크하면 아래 시·군·구가 모두 체크되고, 일부만 뺄 수 있다
        ...REGIONS.map((r) => ({ label: r.label, region: true, items: toItems(r.sources.map((k) => PRESS_SOURCES.find((x) => x.key === k)).filter((x): x is (typeof PRESS_SOURCES)[number] => !!x)) })),
      ]).filter((g) => g.items.length > 0)
  pickGroups.unshift({ label: t('내가 넣은 자료', 'My own'), items: [{ key: 'email', name: t('메일', 'Email'), saved: false, auto: false, tier: tierOf.get('email') }, { key: MANUAL_SOURCE, name: t('직접 등록', 'Added manually'), saved: false, auto: false, tier: tierOf.get(MANUAL_SOURCE) }] })
  // 맞춤 자료 탭 위 출처 버튼: 매체 분야의 출처 + 켠 해외 언론 + 편집장이 체크해 넣은 출처만. 정부·지자체처럼 제목 키워드로 골라 오는 출처는 버튼으로 늘어놓지 않는다(출처별로 보려면 전체 탭)
  const recSources = english ? new Set([...usLocal, ...(titleHit.length ? usWire : [])]) : new Set([...fieldKeys, ...foreignKeys, ...pickedKeys])
  // 추천 분야·키워드를 아직 정하지 않은 한국어 매체 (추천 탭에 안내를 보인다)
  const noRecSetup = !english && !fields.length && !titleHit.length && !pickedKeys.length
  if (english) {
    // 영문 매체: 지역·기관 소식은 늘, 전국 뉴스와이어는 추천 키워드가 제목에 있을 때만
    if (tab === 'rec') query = query.or([`source_key.in.(${[MANUAL_SOURCE, 'email', ...usLocal].join(',')})`, ...(titleHit.length && usWire.length ? [`and(source_key.in.(${usWire.join(',')}),or(${titleHit.join(',')}))`] : [])].join(','))
  } else if (tab === 'rec' && fields.length) {
    query = query.or([`source_key.in.(${recBase.join(',')})`, ...(titleHit.length && generalKeys.length ? [`and(source_key.in.(${generalKeys.join(',')}),or(${titleHit.join(',')}))`] : [])].join(','))
  } else if (tab === 'rec' && titleHit.length) {
    query = query.or([`source_key.in.(${recBase.join(',')})`, ...titleHit].join(','))
  } else if (tab === 'rec') {
    // 분야도 키워드도 정하지 않은 매체: 모든 출처를 다 보여 주지 않고 메일·직접 등록(과 켠 해외 언론)만 추천에 넣는다
    query = query.in('source_key', recBase)
  }

  // 맞춤 자료(그룹) 모드: 추천 탭에서, 검색·출처 고르기 없이, 그룹을 정한 매체
  //   그룹 1→4 순서로, 그룹에 담은 키워드·출처마다 따로 최신 N건씩 가져와 합친다 (자료가 많은 곳이 다른 곳을 밀어내지 않게). 같은 자료는 앞 그룹에만 둔다
  //   그룹에 안 담은 메일·직접 등록은 맨 앞에(출처당 10건), 그룹 없이 ★로 넣은 출처는 맨 뒤에(출처당 3건) 둔다
  const tiers = outletSite?.pressTiers ?? []
  const tiered = tab === 'rec' && !q && !src && !sec && hasPressTiers(tiers)
  const tierRows = async (): Promise<{ data: PressRow[]; count: number }> => {
    const sinceKw = new Date(Date.now() - TIER_DAYS * 86400e3).toISOString()
    const sinceSrc = new Date(Date.now() - TIER_SRC_DAYS * 86400e3).toISOString()
    const visible = new Set([...PRESS_SOURCES.map((x) => x.key), 'email', MANUAL_SOURCE])
    const grouped = new Set(tiers.flatMap((g) => g.sources))
    type Block = { ti: number; limit: number; kws: string[]; srcs: string[] }
    const blocks: Block[] = [
      { ti: -1, limit: TIER_OWN_LIMIT, kws: [], srcs: ['email', MANUAL_SOURCE].filter((k) => !grouped.has(k)) },
      ...tiers.map((g, ti) => ({ ti, limit: g.limit, kws: usableKeywords(g.keywords), srcs: g.sources.filter((k) => visible.has(k)) })),
      { ti: 4, limit: TIER_LEGACY_LIMIT, kws: [], srcs: pickedKeys.filter((k) => !grouped.has(k)) },
    ]
    const cols = 'id, source_key, source_name, title, summary, link, published_at'
    const win = (since: string) => `published_at.gte.${since},and(published_at.is.null,fetched_at.gte.${since})`
    const jobs: (() => Promise<PressRow[]>)[] = []
    for (const b of blocks) {
      for (const k of b.kws) jobs.push(async () => {
        let qy = pressScope(supabase.from('press_releases').select(cols), ctx)
        qy = english ? qy.or(`source_key.like.us-*,source_key.in.(${MANUAL_SOURCE},email)`) : qy.not('source_key', 'like', 'us-%')
        if (!english) for (const ft of FOREIGN_TOPICS) if (!topics.includes(ft.key)) qy = qy.not('source_key', 'like', `${ft.prefix}%`)
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

  const [{ data: rowsRaw, count }, { data: logs }, { data: todayUses }] = await Promise.all([
    tiered ? tierRows() : query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    supabase.from('press_fetch_log').select('*'),
    outletId
      ? supabase.from('articles').select('id, press_release:press_releases(source_key)').eq('outlet_id', outletId).not('press_release_id', 'is', null).gte('created_at', kstMidnightIso())
      : Promise.resolve({ data: [] as any[] }),
  ])

  const rows = (rowsRaw ?? []) as PressRow[]
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
    Object.entries({ tab: tab === 'all' ? 'all' : undefined, src, q, sec: sec?.name, ...p }).forEach(([k, v]) => v && sp.set(k, v))
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
                  href={href({ tab: tb.key === 'all' ? 'all' : undefined, page: undefined, sec: undefined })}
                  aria-current={tab === tb.key ? 'page' : undefined}
                  className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-2.5 py-3.5 text-[14px] md:px-4 ${tab === tb.key ? 'border-ink font-bold text-ink' : 'border-transparent text-muted hover:text-ink'}`}
                >
                  {tb.label}
                </Link>
              ))}
            </nav>
            <form action="/press" className="flex w-full items-center gap-2 px-2 py-2 md:w-auto md:px-0">
              {tab === 'all' && <input type="hidden" name="tab" value="all" />}
              {src && <input type="hidden" name="src" value={src} />}
              {selected.map((k) => <input key={k} type="hidden" name="s" value={k} />)}
              <label htmlFor="press-q" className="sr-only">{t('제목 검색', 'Search titles')}</label>
              <input id="press-q" name="q" defaultValue={q} placeholder={t('제목 검색', 'Search titles')} className="field-input h-9 min-w-0 flex-1 py-1.5 md:w-52 md:flex-none" />
              <button type="submit" className="btn-secondary h-9 py-1.5">{t('검색', 'Search')}</button>
            </form>
          </div>

          {tab === 'rec' && <div className="flex gap-1.5 overflow-x-auto border-b border-line px-4 py-3 md:flex-wrap md:px-5 [&>a]:shrink-0 [&>a]:whitespace-nowrap">
            <Link href={href({ src: undefined, page: undefined })} className={`rounded-full border px-3 py-1 text-[12px] ${!src ? 'border-ink bg-ink text-white' : 'border-line text-muted hover:border-ink hover:text-ink'}`}>{t('모든 출처', 'All sources')}</Link>
            <Link href={href({ src: 'email', page: undefined })} className={`rounded-full border px-3 py-1 text-[12px] ${src === 'email' ? 'border-ink bg-ink text-white' : 'border-line text-muted hover:border-ink hover:text-ink'}`}>{t('메일', 'Email')}</Link>
            <Link href={href({ src: MANUAL_SOURCE, page: undefined })} className={`rounded-full border px-3 py-1 text-[12px] ${src === MANUAL_SOURCE ? 'border-ink bg-ink text-white' : 'border-line text-muted hover:border-ink hover:text-ink'}`}>{t('직접 등록', 'Added manually')}</Link>
            {sectionPills.length > 0 && <span aria-hidden className="mx-1 self-center text-line">|</span>}
            {sectionPills.map((x) => (
              <Link key={x.name} href={href({ sec: sec?.name === x.name ? undefined : x.name, page: undefined })} title={t('섹션 이름으로 고른 자료', 'Matched from this section’s name')} className={`rounded-full border px-3 py-1 text-[12px] ${sec?.name === x.name ? 'border-ink bg-ink text-white' : 'border-dashed border-line text-muted hover:border-ink hover:text-ink'}`}>
                {x.name}
              </Link>
            ))}
            {recSources && recSources.size > 0 && <span aria-hidden className="mx-1 self-center text-line">|</span>}
            {PRESS_SOURCES.filter((s) => !recSources || recSources.has(s.key)).map((s) => (
              <Link key={s.key} href={href({ src: s.key, page: undefined })} className={`rounded-full border px-3 py-1 text-[12px] ${src === s.key ? 'border-ink bg-ink text-white' : 'border-line text-muted hover:border-ink hover:text-ink'}`}>
                {s.name.replace('뉴스와이어 · ', '')}
              </Link>
            ))}
          </div>}

          {tab === 'all' && pickGroups.length > 0 && (
            <PressSourceFilter
              groups={pickGroups}
              selected={selected}
              q={q}
              canPick={canPick}
              saveAction={savePressSources}
              tierAction={savePressTierSources}
              text={{
                title: t('출처 고르기', 'Pick sources'),
                hint: t('체크하면 그 출처의 자료만 아래에 보입니다', 'Check sources to see only their releases below'),
                clear: t('선택 해제', 'Clear'),
                add: t('★ 맞춤 자료에 넣기', '★ Add to My feed'),
                remove: t('맞춤 자료에서 빼기', 'Remove from My feed'),
                only: t('★는 이미 맞춤 자료에 들어 있는 출처입니다. 체크한 뒤 버튼을 누르면 왼쪽 “맞춤 자료”에 모입니다. AI 자동 작성도 이 자료를 씁니다.', '★ marks sources already in My feed. Check sources and use the buttons to add them to “My feed”. AI auto-writing also uses them.'),
                savedMark: t('맞춤 자료에 들어 있음', 'In My feed'),
                autoMark: t('(분야 설정)', '(field setting)'),
                editorOnly: t('맞춤 자료에 넣기는 편집장이 합니다', 'The editor adds sources to My feed'),
                open: t('열기', 'Open'),
                close: t('닫기', 'Close'),
                regionHint: t('광역을 체크하면 아래 시·군·구가 모두 체크됩니다. 빼고 싶은 곳만 체크를 풀어 주세요.', 'Check a region to select all its cities and districts, then uncheck the ones you don’t want.'),
                regionAll: t('전체 선택', 'Select all'),
                tierHint: t('① 체크한 출처를 그룹에 담기 → (건수는 위쪽 “맞춤 자료 그룹 설정”에서 바꿉니다)', '① Put checked sources into a group → (change the counts in “Custom feed groups” above)'),
                tierAdd: [1, 2, 3, 4].map((n) => t(`그룹 ${n}에 넣기 · 출처당 ${(outletSite?.pressTiers ?? [])[n - 1]?.limit ?? [10, 5, 3, 1][n - 1]}건`, `Add to group ${n} · ${(outletSite?.pressTiers ?? [])[n - 1]?.limit ?? [10, 5, 3, 1][n - 1]} per source`)),
                tierRemove: t('그룹에서 빼기', 'Remove from groups'),
                tierMark: t('맞춤 자료 그룹 번호 (그룹마다 출처 하나당 보이는 최신 건수가 다릅니다)', 'My feed group number (each group shows a different number of latest items per source)'),
              }}
            />
          )}
          {searchParams.msg && <p className="border-b border-line bg-[#FFF8E6] px-4 py-2.5 text-[12.5px] text-[#6B4E00] md:px-5">{searchParams.msg.slice(0, 200)}</p>}

          {outletId && (ctx.isEditorPlus || ctx.isStaff) && (
            <PressTierSettings outletId={outletId} initial={tiers} active={hasPressTiers(tiers)} sourceNames={Object.fromEntries([...PRESS_SOURCES.map((x) => [x.key, x.name.replace('뉴스와이어 · ', '')]), ['email', t('메일', 'Email')], [MANUAL_SOURCE, t('직접 등록', 'Added manually')]])} suggestions={Array.from(new Set([...sectionNames, ...keywords])).slice(0, 40)} />
          )}
          {tiered && (
            <p className="border-b border-line bg-[#F1F6FF] px-4 py-2.5 text-[12.5px] leading-relaxed text-[#27456F] md:px-5">
              {t(`내가 정한 그룹대로 모았습니다 (키워드는 최근 ${TIER_DAYS}일, 출처는 최근 ${TIER_SRC_DAYS}일). 그룹 1이 가장 위, 키워드·출처마다 정한 건수만큼만 나옵니다. 출처는 “전체” 탭에서 담습니다.`, `Collected by your groups (keywords: last ${TIER_DAYS} days, sources: last ${TIER_SRC_DAYS} days). Group 1 comes first, each keyword/source limited to its count. Add sources in the “All” tab.`)}
            </p>
          )}
          {tab === 'rec' && auto && !noRecSetup && !tiered && (
            <p className="border-b border-line bg-[#F1F6FF] px-4 py-3 text-[12.5px] leading-relaxed text-[#27456F] md:px-5">
              {t('맞춤 키워드를 따로 정하지 않아 이 매체의 섹션 이름으로 관련 보도자료를 골랐습니다', 'No keywords are set, so releases were matched to this outlet’s section names')}
              {auto.keywords.length > 0 && <> ({auto.keywords.slice(0, 8).join(', ')}{auto.keywords.length > 8 ? ' …' : ''})</>}.
              {outletId && <> <Link href={ctx.isStaff ? `/admin/outlets/${outletId}/site#s-press` : '/admin/settings#s-press'} className="font-semibold underline">{t('직접 정하기', 'Set your own')}</Link></>}
            </p>
          )}
          {tab === 'rec' && noRecSetup && !tiered && (
            <p className="border-b border-line bg-[#FFF8E6] px-4 py-3 text-[12.5px] leading-relaxed text-[#6B4E00] md:px-5">
              {t('이 매체의 맞춤 분야·키워드가 아직 없어 메일·직접 등록 자료만 보입니다. ', 'No feed fields or keywords are set for this outlet yet, so only email and manually added releases are shown. ')}
              {outletId && <Link href={ctx.isStaff ? `/admin/outlets/${outletId}/site#s-press` : '/admin/settings#s-press'} className="font-semibold underline">{t('홈페이지 설정 → 보도자료 맞춤 키워드에서 정하기', 'Set them in Website settings → press keywords')}</Link>}
              {t(' (예: 경기, 수원, 성남 …). 전체 자료는 “전체” 탭에서 볼 수 있습니다.', ' (e.g. local place names). See everything in the “All” tab.')}
            </p>
          )}

          {rows.length ? (
            <ul className="divide-y divide-line">
              {rows.map((r, i) => (
                <li key={r.id}>
                  {tiered && (i === 0 || rows[i - 1].tier !== r.tier) && (
                    <p className="bg-[#F8F9FA] px-4 py-1.5 text-[12px] font-bold text-ink md:px-5">
                      {r.tier === -1 ? t(`내가 넣은 자료(메일·직접 등록) · 출처당 최신 ${TIER_OWN_LIMIT}건`, `My own (email · manual) · latest ${TIER_OWN_LIMIT} per source`)
                        : r.tier === 4 ? t(`그룹 없이 넣은 출처(★) · 출처당 최신 ${TIER_LEGACY_LIMIT}건`, `Sources added without a group (★) · latest ${TIER_LEGACY_LIMIT} per source`)
                        : t(`그룹 ${(r.tier ?? 0) + 1} · 키워드·출처당 최신 ${tiers[r.tier ?? 0]?.limit}건`, `Group ${(r.tier ?? 0) + 1} · latest ${tiers[r.tier ?? 0]?.limit} per keyword/source`)}
                    </p>
                  )}
                  <Link href={`/press/${r.id}`} className="block px-4 py-4 hover:bg-[#F8F9FA] md:px-5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-muted">
                      {r.source_key === MANUAL_SOURCE && <span className="rounded bg-ink px-1.5 py-0.5 text-white">{t('직접 등록', 'Added manually')}</span>}
                      {r.source_key === 'email' && <span className="rounded bg-review px-1.5 py-0.5 text-white">{t('메일', 'Email')}</span>}
                      {tiered && r.kw && <span className="rounded bg-ink/10 px-1.5 py-0.5 font-semibold text-ink">{r.kw}</span>}
                      <span className="rounded bg-line/70 px-1.5 py-0.5">{r.source_name}</span>
                      <time className="tabular-nums" dateTime={r.published_at ?? undefined}>{formatShort(r.published_at, lang)}</time>
                      {usedSet.has(r.id) && <span className="rounded bg-published/10 px-1.5 py-0.5 font-semibold text-published">{t('기사화됨', 'Story created')}</span>}
                    </div>
                    <p className="mt-1.5 text-[15px] font-semibold leading-snug">{r.title}</p>
                    {r.summary && <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">{r.summary}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-20 text-center text-[14px] text-muted">
              {q ? (lang === 'en' ? `No press releases match ‘${q}’.` : `‘${q}’에 해당하는 보도자료가 없습니다.`) : tab === 'rec' ? t('맞춤 자료에 맞는 보도자료가 아직 없습니다. “전체” 탭에서 받고 싶은 출처를 골라 보세요.', 'Nothing matches your feed yet. Pick sources in the “All” tab.') : t('아직 가져온 보도자료가 없습니다.', 'No press releases have been collected yet.')}
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
