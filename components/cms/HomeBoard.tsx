'use client'

import { useEffect, useMemo, useState, type DragEvent } from 'react'
import { createClient } from '@/lib/supabase'
import { refreshOutletPages } from '@/app/(main)/articles/refresh'
import { formatDateTime } from '@/lib/format'
import { HERO_SECONDS, SLOTS, slotLabel, type HomeLayout, type SlotKey } from '@/lib/home-layout'
import { useT, useCmsLang } from '@/components/cms/CmsLang'
import { HOME_LAYOUTS, type HomeLayout as HomeLayoutKey } from '@/lib/home-layouts'

export type BoardArticle = { id: string; title: string; thumbnail_url: string | null; published_at: string | null; category: string | null }

type Pos = { slot: SlotKey; index: number }
type DragData = { id: string; from?: Pos }

const SLOT = Object.fromEntries(SLOTS.map((s) => [s.key, s])) as Record<SlotKey, (typeof SLOTS)[number]>
const range = (n: number) => Array.from({ length: n }, (_, i) => i)
// 홈 모양 이름 (영어 화면용)
const LAYOUT_EN: Record<string, { name: string; label: string }> = {
  standard: { name: 'Korean style 1', label: 'Standard 3-column' },
  portal: { name: 'Korean style 2', label: 'Portal list' },
  bands: { name: 'Korean style 3', label: 'Section bands' },
  editorial: { name: 'US style 1', label: 'Editorial' },
  cards: { name: 'US style 2', label: 'Card magazine' },
}

// 홈페이지 첫 화면 모양(홈 배치)별로 기사 자리를 그 모양 그대로 놓는다. 회색 칸은 자동으로 채워지는 자리
export default function HomeBoard({ outletId, siteUrl = '/', homeLayout = 'standard', initialLayout, initialHeroSeconds = 5, articles, savedAt }: {
  siteUrl?: string
  homeLayout?: HomeLayoutKey
  outletId: string
  initialLayout: HomeLayout
  initialHeroSeconds?: number
  articles: BoardArticle[]
  savedAt: string | null
}) {
  const t = useT()
  const lang = useCmsLang()
  const [layout, setLayout] = useState(initialLayout)
  const [baseline, setBaseline] = useState(JSON.stringify(initialLayout))
  // 톱 헤드라인 슬라이드가 다음 기사로 넘어가는 간격(초)
  const [heroSeconds, setHeroSeconds] = useState(initialHeroSeconds)
  const [baseHero, setBaseHero] = useState(initialHeroSeconds)
  const [selected, setSelected] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [over, setOver] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(savedAt ? { ok: true, text: t(`마지막 저장 ${formatDateTime(savedAt)}`, `Last saved ${formatDateTime(savedAt, lang)}`) } : null)

  const byId = useMemo(() => new Map(articles.map((a) => [a.id, a])), [articles])
  // 공개 시각이 아직 안 됐거나 없는 기사는 홈페이지에 나오지 않는다 (예약 발행). 배치해도 빈 자리처럼 보이므로 표시해 준다
  const notLive = (a: BoardArticle | undefined) => !!a && (!a.published_at || Date.parse(a.published_at) > Date.now())
  const placed = useMemo(() => new Set(Object.values(layout).flat().filter(Boolean) as string[]), [layout])
  const dirty = JSON.stringify(layout) !== baseline || heroSeconds !== baseHero
  const filtered = articles.filter((a) => !query.trim() || a.title.includes(query.trim()))

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function place(id: string, to: Pos, from?: Pos) {
    setLayout((prev) => {
      const next = Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, [...v]])) as HomeLayout
      const displaced = next[to.slot][to.index]
      // 같은 기사가 두 자리에 있지 않게 기존 자리를 비운다
      for (const k of Object.keys(next) as SlotKey[]) next[k] = next[k].map((x) => (x === id ? null : x))
      next[to.slot][to.index] = id
      if (from && displaced && displaced !== id) next[from.slot][from.index] = displaced
      return next
    })
    setSelected(null)
  }

  function clear(pos: Pos) {
    setLayout((prev) => ({ ...prev, [pos.slot]: prev[pos.slot].map((x, i) => (i === pos.index ? null : x)) }))
  }

  function onDrop(e: DragEvent, to: Pos) {
    e.preventDefault()
    setOver(null)
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain')) as DragData
      if (data.id) place(data.id, to, data.from)
    } catch {
      /* 다른 곳에서 끌어온 내용은 무시 */
    }
  }

  const dragStart = (data: DragData) => (e: DragEvent) => {
    e.dataTransfer.setData('text/plain', JSON.stringify(data))
    e.dataTransfer.effectAllowed = 'move'
  }

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('home_layouts').upsert({
      outlet_id: outletId,
      layout: { ...layout, heroSeconds },
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
    if (error) {
      setMessage({ ok: false, text: `${t('저장하지 못했습니다', 'Could not save')}: ${error.message}` })
    } else {
      setBaseline(JSON.stringify(layout))
      setBaseHero(heroSeconds)
      if (outletId) await refreshOutletPages(outletId).catch(() => {})
      const n = layout.headline.filter(Boolean).length
      setMessage({ ok: true, text: t(`저장했습니다. 홈페이지에 바로 반영됩니다.${n > 1 ? ` (톱 헤드라인 슬라이드 ${n}개)` : ''}`, `Saved. The change goes live on your homepage right away.${n > 1 ? ` (${n} top headline slides)` : ''}`) })
    }
  }

  const info0 = HOME_LAYOUTS.find((l) => l.key === homeLayout) ?? HOME_LAYOUTS[0]
  const info = lang === 'en' ? { ...info0, ...(LAYOUT_EN[info0.key] ?? {}) } : info0

  // 기사 자리 한 칸 (끌어다 놓기·누르기·비우기는 모든 모양에서 같다)
  function cell(slot: SlotKey, index: number, o: { large?: boolean; compact?: boolean; className?: string } = {}) {
    const sl = SLOT[slot]
    const slLabel = slotLabel(sl, lang)
    const pos = { slot, index }
    const key = `${slot}-${index}`
    const id = layout[slot][index]
    const a = id ? byId.get(id) : undefined
    const large = !!o.large
    return (
      <div
        key={key}
        onDragOver={(e) => { e.preventDefault(); setOver(key) }}
        onDragLeave={() => setOver((x) => (x === key ? null : x))}
        onDrop={(e) => onDrop(e, pos)}
        onClick={() => selected && place(selected, pos)}
        className={`relative min-w-0 rounded border-2 transition-colors ${
          over === key ? 'border-review bg-review/5' : a ? 'border-line bg-white' : 'border-dashed border-line bg-[#FAFBFC]'
        } ${selected ? 'cursor-pointer hover:border-review' : ''} ${large ? 'min-h-[150px]' : o.compact ? 'min-h-[88px]' : 'min-h-[92px]'} ${o.className ?? ''}`}
      >
        <span className="absolute left-2 top-1.5 text-[10.5px] font-semibold text-muted">{sl.count > 1 ? `${slLabel} ${index + 1}` : slLabel}</span>
        {a ? (
          <div draggable onDragStart={dragStart({ id: a.id, from: pos })} className={`flex cursor-grab gap-3 p-3 pt-6 active:cursor-grabbing ${large ? 'items-center' : ''}`}>
            {a.thumbnail_url && !o.compact && (
              <img src={a.thumbnail_url} alt="" className={`shrink-0 rounded-sm object-cover ${large ? 'h-[84px] w-[140px]' : 'hidden h-[46px] w-[70px] sm:block'}`} />
            )}
            <div className="min-w-0 flex-1">
              {a.category && <p className="text-[11px] text-muted">{a.category}</p>}
              {notLive(a) && <p className="mb-0.5 w-fit rounded bg-danger/10 px-1.5 text-[10.5px] font-semibold text-danger">{t('공개 전 · 홈페이지에 안 나옴', 'Not public yet · hidden on the site')}</p>}
              <p className={`line-clamp-2 font-semibold leading-snug ${large ? 'text-[16px]' : 'text-[13px]'}`}>{a.title}</p>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); clear(pos) }}
              aria-label={t(`${slLabel} ${index + 1}번 자리 비우기`, `Clear ${slLabel} slot ${index + 1}`)}
              className="absolute right-1.5 top-1 rounded px-1.5 text-[14px] text-muted hover:bg-danger/10 hover:text-danger"
            >
              ×
            </button>
          </div>
        ) : (
          <p className="flex h-full min-h-[inherit] items-center justify-center px-3 pt-4 text-center text-[12px] text-muted">
            {id ? t('발행 취소된 기사입니다. 다른 기사로 바꿔주세요.', 'This story has been unpublished. Replace it with another story.') : slot === 'pick' || (slot === 'headline' && index > 0) ? t('비어 있음', 'Empty') : t('비어 있음 · 자동 배치', 'Empty · filled automatically')}
          </p>
        )}
      </div>
    )
  }
  // 자동으로 채워지는 자리 (직접 놓을 수 없다)
  const auto = (label: string, cls = '') => (
    <div className={`flex items-center justify-center rounded border-2 border-dashed border-[#DDE1E7] bg-[#F1F3F6] px-3 py-2 text-center text-[11.5px] text-muted ${cls}`}>{label}</div>
  )
  const head = (title: string, note?: string) => (
    <p className="mb-2 mt-5 text-[12.5px] font-bold">{title}{note && <span className="ml-2 font-normal text-muted">{note}</span>}</p>
  )
  const unused = (text: string) => <p className="mt-2 rounded bg-[#F6F7F9] px-3 py-2 text-[12px] text-muted">{text}</p>
  const picks = (
    <>
      {head(t('이슈 PICK', 'Featured picks'), t('채운 경우에만 홈페이지에 나옵니다', 'Shown on the homepage only when filled'))}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{range(4).map((i) => cell('pick', i))}</div>
    </>
  )

  const THREE = 'md:grid-cols-[minmax(0,22%)_minmax(0,1fr)_minmax(0,24%)]'
  const canvases: Record<HomeLayoutKey, React.ReactNode> = {
    // 한국 스타일 1: 왼쪽 2 · 가운데 큰 톱 · 오른쪽 실시간 / 주요뉴스 3열
    standard: (
      <>
        <div className={`grid gap-3 ${THREE}`}>
          <div className="grid gap-3">{cell('top', 0, { compact: true })}{cell('top', 1, { compact: true })}</div>
          <div className="grid gap-3">{cell('headline', 0, { large: true })}{auto(t('헤드라인 아래 최신 기사 4건 (자동)', '4 latest stories below the headline (automatic)'), 'min-h-[64px]')}</div>
          {auto(t('실시간 뉴스 (자동)', 'Live news (automatic)'), 'min-h-[120px]')}
        </div>
        {head(t('주요뉴스', 'Top stories'), t('비우면 최신 기사로 자동', 'If empty, filled with the latest stories'))}
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,24%)]">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{range(6).map((i) => cell('major', i))}</div>
          {auto(t('많이 본 뉴스 (자동)', 'Most read (automatic)'), 'min-h-[120px]')}
        </div>
        {picks}
      </>
    ),
    // 한국 스타일 2: 속보 띠 · 큰 사진 + 오른쪽 목록 / 이슈 PICK / 주요뉴스 2열
    portal: (
      <>
        {auto(t('속보 띠 — 최신 기사 5건 (자동)', 'Breaking news strip — 5 latest stories (automatic)'), 'mb-3 min-h-[34px]')}
        <div className="grid gap-3 md:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          {cell('headline', 0, { large: true, className: 'md:min-h-[230px]' })}
          <div className="grid gap-3">{cell('top', 0)}{cell('top', 1)}{auto(t('최신 제목 목록 4건 (자동)', 'List of 4 latest headlines (automatic)'), 'min-h-[64px]')}</div>
        </div>
        {picks}
        {head(t('주요뉴스', 'Top stories'), t('비우면 최신 기사로 자동', 'If empty, filled with the latest stories'))}
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,24%)]">
          <div className="grid gap-3 sm:grid-cols-2">{range(6).map((i) => cell('major', i))}</div>
          {auto(t('많이 본 뉴스 (자동)', 'Most read (automatic)'), 'min-h-[120px]')}
        </div>
        {auto(t('섹션별 박스 (자동)', 'Section boxes (automatic)'), 'mt-3 min-h-[48px]')}
      </>
    ),
    // 한국 스타일 3: 큰 톱(글+사진) · 아래 카드 4장 / 섹션 띠 (주요뉴스 자리는 쓰지 않는다)
    bands: (
      <>
        {cell('headline', 0, { large: true })}
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          {cell('top', 0)}{cell('top', 1)}{auto(t('최신 기사 (자동)', 'Latest story (automatic)'), 'min-h-[88px]')}{auto(t('최신 기사 (자동)', 'Latest story (automatic)'), 'min-h-[88px]')}
        </div>
        {auto(t('섹션별 띠 — 메뉴 순서대로 자동', 'Section bands — automatic, in menu order'), 'mt-3 min-h-[64px]')}
        {picks}
        {unused(t('“주요뉴스” 자리는 이 홈 모양에서 쓰지 않습니다. 다른 모양으로 바꾸면 전에 놓은 기사가 그대로 쓰여요.', 'The “Top stories” slots are not used in this home layout. If you switch to another layout, the stories you placed earlier are used again.'))}
      </>
    ),
    // 미국 스타일 1: 왼쪽 글 2 · 가운데 큰 톱 · 오른쪽 많이 본 기사 / 이슈 PICK / 주요뉴스 4칸
    editorial: (
      <>
        <div className={`grid gap-3 ${THREE}`}>
          <div className="grid gap-3">{cell('top', 0, { compact: true })}{cell('top', 1, { compact: true })}{auto(t('실시간 3건 (자동)', '3 live stories (automatic)'), 'min-h-[64px]')}</div>
          <div className="grid gap-3">{cell('headline', 0, { large: true })}{auto(t('헤드라인 아래 최신 기사 4건 (자동)', '4 latest stories below the headline (automatic)'), 'min-h-[64px]')}</div>
          {auto(t('많이 본 기사 (자동)', 'Most read (automatic)'), 'min-h-[120px]')}
        </div>
        {picks}
        {head(t('주요뉴스', 'Top stories'), t('앞의 4칸을 씁니다', 'The first 4 slots are used'))}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{range(4).map((i) => cell('major', i))}</div>
        {unused(t('주요뉴스 5·6번 자리는 이 홈 모양에서 쓰지 않습니다.', 'Top stories slots 5 and 6 are not used in this home layout.'))}
        {auto(t('섹션별 3열 (자동)', 'Section columns (automatic)'), 'mt-3 min-h-[48px]')}
      </>
    ),
    // 미국 스타일 2: 넓은 톱 사진 · 아래 카드 6장(앞 2장만 직접) / 이슈 PICK / 주요뉴스 카드 4장
    cards: (
      <>
        {cell('headline', 0, { large: true, className: 'min-h-[170px]' })}
        {head(t('톱 아래 카드 6장', '6 cards below the top story'), t('앞의 2장은 직접, 나머지 4장은 최신 기사로 자동', 'Place the first 2 yourself; the other 4 are filled with the latest stories'))}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {cell('top', 0)}{cell('top', 1)}{range(4).map((i) => <div key={`a${i}`}>{auto(t('최신 기사 (자동)', 'Latest story (automatic)'), 'min-h-[92px]')}</div>)}
        </div>
        {picks}
        {auto(t('많이 본 뉴스 (자동)', 'Most read (automatic)'), 'mt-3 min-h-[48px]')}
        {head(t('주요뉴스', 'Top stories'), t('앞의 4칸을 카드로 씁니다', 'The first 4 slots are shown as cards'))}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{range(4).map((i) => cell('major', i))}</div>
        {unused(t('주요뉴스 5·6번 자리는 이 홈 모양에서 쓰지 않습니다.', 'Top stories slots 5 and 6 are not used in this home layout.'))}
        {auto(t('섹션별 줄 (자동)', 'Section rows (automatic)'), 'mt-3 min-h-[48px]')}
      </>
    ),
  }
  const canvas = canvases[homeLayout] ?? canvases.standard

  return (
    <div className="grid grid-cols-1 items-start gap-6 pb-24 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-lg border border-line bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <h2 className="text-[15px] font-bold">{info.name} <span className="font-medium text-muted">· {info.label}</span></h2>
          <span className="text-[12px] text-muted">{t('홈페이지 첫 화면 그대로 놓습니다. 회색 칸은 최신 기사로 자동 채워져요.', 'Arrange stories as they appear on the homepage front page. Gray boxes are filled automatically with the latest stories.')}</span>
          <a href={`/admin/outlets/${outletId}/site`} className="ml-auto text-[12px] font-semibold text-[#2F6BF0] hover:underline">{t('홈 모양 바꾸기', 'Change home layout')}</a>
        </div>
        {canvas}
        {(
          <div className="mt-6 rounded-lg border border-line bg-[#FAFBFC] p-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div>
                <p className="text-[13.5px] font-bold">{t('톱 헤드라인 슬라이드', 'Top headline slideshow')}</p>
                <p className="mt-0.5 text-[12px] text-muted">{t('위 “톱 헤드라인 1”에 이어 아래 칸에 기사를 더 넣으면(최대 10개) 홈 가운데에서 자동으로 한 장씩 넘어갑니다. 1개만 두면 넘어가지 않습니다.', 'Add more stories in the slots below, after “Top headline 1” (up to 10), and the center of the home page advances one by one automatically. With just one, it stays still.')}</p>
              </div>
              <label className="flex items-center gap-2 text-[13px]">
                <span className="font-semibold">{t('넘어가는 간격', 'Advance every')}</span>
                <select value={heroSeconds} onChange={(e) => setHeroSeconds(Number(e.target.value))} className="field-input w-24 py-1">
                  {HERO_SECONDS.map((n) => <option key={n} value={n}>{t(`${n}초`, `${n} s`)}</option>)}
                </select>
              </label>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">{range(9).map((i) => cell('headline', i + 1, { compact: true }))}</div>
            <p className="mt-2 text-[12px] text-muted">{t('지금 슬라이드에 들어간 기사', 'Stories in the slideshow now')}: {layout.headline.filter(Boolean).length}{t('개', '')}{layout.headline.some((id) => notLive(id ? byId.get(id) : undefined)) && <span className="ml-1 font-semibold text-danger">{t(`(그중 ${layout.headline.filter((id) => notLive(id ? byId.get(id) : undefined)).length}개는 공개 전이라 홈페이지에 안 나옵니다)`, ` (${layout.headline.filter((id) => notLive(id ? byId.get(id) : undefined)).length} not public yet, so hidden on the site)`)}</span>}</p>
          </div>
        )}
      </section>

      <aside className="flex max-h-[70vh] flex-col lg:sticky lg:top-6 lg:max-h-[calc(100vh-150px)] rounded-lg border border-line bg-white">
        <div className="border-b border-line p-4">
          <h2 className="text-[15px] font-bold">{t('발행된 기사', 'Published stories')}</h2>
          <label htmlFor="board-q" className="sr-only">{t('기사 제목 검색', 'Search story titles')}</label>
          <input id="board-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('제목으로 찾기', 'Search by title')} className="field-input mt-2.5" />
          {selected && (
            <p className="mt-2 rounded bg-review/10 px-2.5 py-1.5 text-[12px] text-review">
              {t('선택됨 — 왼쪽에서 넣을 자리를 누르세요.', 'Selected — click the slot on the left where you want it.')} <button type="button" className="underline" onClick={() => setSelected(null)}>{t('취소', 'Cancel')}</button>
            </p>
          )}
        </div>
        <ul className="flex-1 divide-y divide-line overflow-y-auto">
          {filtered.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                draggable
                onDragStart={dragStart({ id: a.id })}
                onClick={() => setSelected((s) => (s === a.id ? null : a.id))}
                aria-pressed={selected === a.id}
                className={`flex w-full cursor-grab gap-3 px-4 py-3 text-left active:cursor-grabbing ${selected === a.id ? 'bg-review/10' : 'hover:bg-[#F8F9FA]'}`}
              >
                {a.thumbnail_url ? (
                  <img src={a.thumbnail_url} alt="" className="h-[42px] w-[64px] shrink-0 rounded-sm object-cover" />
                ) : (
                  <span className="h-[42px] w-[64px] shrink-0 rounded-sm bg-line/60" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[13px] font-medium leading-snug">{a.title}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                    {a.category && <span>{a.category}</span>}
                    <span className="tabular-nums">{formatDateTime(a.published_at, lang)}</span>
                    {placed.has(a.id) && <span className="rounded bg-published/10 px-1 text-published">{t('배치됨', 'Placed')}</span>}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {!filtered.length && <li className="px-4 py-10 text-center text-[13px] text-muted">{t('발행된 기사가 없습니다.', 'There are no published stories.')}</li>}
        </ul>
      </aside>

      <div className="cms-actionbar border-t border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 md:px-8 md:py-3">
          {message && <p role="status" className={`text-[13px] ${message.ok ? 'text-muted' : 'text-danger'}`}>{message.text}</p>}
          {dirty && <span className="text-[13px] font-semibold text-draft">{t('저장하지 않은 변경이 있습니다', 'You have unsaved changes')}</span>}
          <div className="ml-auto flex gap-2">
            <a href={siteUrl} target="_blank" rel="noopener" className="btn-secondary">{t('홈페이지 보기 ↗', 'View homepage ↗')}</a>
            <button type="button" onClick={() => { setLayout(JSON.parse(baseline)); setHeroSeconds(baseHero) }} disabled={!dirty || saving} className="btn-secondary">{t('되돌리기', 'Revert')}</button>
            <button type="button" onClick={save} disabled={!dirty || saving} className="btn-publish px-6">{saving ? t('저장 중…', 'Saving…') : t('저장', 'Save')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
