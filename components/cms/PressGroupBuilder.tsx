'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { savePressTiers } from '@/app/(main)/press/actions'
import { useT } from '@/components/cms/CmsLang'
import { PRESS_TIER_DEFAULTS, PRESS_TIER_MAX_KEYWORDS, PRESS_TIER_MAX_LIMIT, type PressTier } from '@/lib/sites'

// 보도자료함 "전체" 탭: 맞춤 자료 만들기
//   ① 위쪽 그룹 카드에서 담을 그룹을 누른다 → ② 아래 출처(광역·시·군·구)를 체크하면 그 자리에서 바로 그 그룹에 담긴다 (새로고침 없이, 저장은 뒤에서 알아서)
//   그룹마다 "하나당 최신 몇 건"을 정하고 키워드도 담을 수 있다. 편집장 이상만 그룹을 고친다. 나머지는 "목록 보기"(체크한 출처 자료만 아래에 보기)만 쓴다
export type PickItem = { key: string; name: string; auto: boolean; saved: boolean }
// region: 접고 펴는 묶음(위 체크로 아래 전부 선택). section: 'local' 지자체 / 'world' 해외 뉴스(미국 외)
export type PickGroup = { label: string; items: PickItem[]; region?: boolean; section?: 'local' | 'world' }

export default function PressGroupBuilder({ outletId, canPick, initial, groups, selected, q, suggestions }: {
  outletId: string | null
  canPick: boolean
  initial: PressTier[]
  groups: PickGroup[]
  selected: string[]
  q?: string
  suggestions: string[]
}) {
  const t = useT()
  const router = useRouter()
  const [tiers, setTiers] = useState<PressTier[]>(() => PRESS_TIER_DEFAULTS.map((d, i) => ({ keywords: initial[i]?.keywords ?? [], sources: initial[i]?.sources ?? [], limit: initial[i]?.limit ?? d })))
  const [active, setActive] = useState(0)
  const [mode, setMode] = useState<'group' | 'view'>(canPick && outletId ? 'group' : 'view')
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [err, setErr] = useState('')
  const latest = useRef(tiers)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const busy = useRef(false)
  const again = useRef(false)

  const names = new Map(groups.flatMap((g) => g.items.map((x) => [x.key, x.name] as [string, string])))
  const owner = new Map(tiers.flatMap((g, i) => g.sources.map((k) => [k, i] as [string, number])))
  const kwOwner = new Map(tiers.flatMap((g, i) => g.keywords.map((k) => [k, i] as [string, number])))
  // 키워드 후보: 이 매체 섹션·설정 키워드 + 이미 그룹에 담은 키워드(직접 입력한 것 포함)
  const kwList = Array.from(new Set([...suggestions, ...tiers.flatMap((g) => g.keywords)]))
  const grouping = mode === 'group' && canPick && !!outletId

  // 저장은 마지막 바뀐 뒤 0.6초 쉬었다가 한 번에 (저장하는 동안 또 바뀌면 끝나고 한 번 더)
  const flush = async () => {
    if (!outletId) return
    if (busy.current) { again.current = true; return }
    busy.current = true
    setStatus('saving')
    do {
      again.current = false
      const r = await savePressTiers(outletId, latest.current)
      if (r.error) { setErr(r.error); setStatus('error'); busy.current = false; return }
    } while (again.current)
    busy.current = false
    setStatus('saved')
  }
  const update = (fn: (cur: PressTier[]) => PressTier[]) => {
    const next = fn(latest.current)
    latest.current = next
    setTiers(next)
    setStatus('saving')
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, 600)
  }

  // 출처를 지금 고른 그룹에 담거나(이미 거기 있으면) 뺀다. 다른 그룹에 있던 것은 옮겨 온다
  const assign = (keys: string[], on: boolean) => update((cur) => cur.map((g, i) => ({
    ...g,
    sources: [...g.sources.filter((k) => !keys.includes(k)), ...(on && i === active ? keys : [])],
  })))
  const toggleOne = (key: string) => assign([key], owner.get(key) !== active)
  const toggleMany = (keys: string[]) => assign(keys, !keys.every((k) => owner.get(k) === active))
  const toggleKeyword = (k: string) => update((cur) => cur.map((g, i) => {
    const has = g.keywords.includes(k)
    const mineNow = kwOwner.get(k) === active
    if (i === active) return { ...g, keywords: mineNow ? g.keywords.filter((x) => x !== k) : [...g.keywords.filter((x) => x !== k), k].slice(-PRESS_TIER_MAX_KEYWORDS) }
    return has ? { ...g, keywords: g.keywords.filter((x) => x !== k) } : g
  }))
  // 그룹 카드에는 낱개 출처를 다 늘어놓지 않고 묶음(광역·분야)으로 한 칸씩만 보인다. 세부 체크는 아래 목록에서 한다
  //   묶음 안의 출처가 일부만 담겼으면 "서울특별시 (24/26)"처럼 개수를 같이 보여 준다
  const removeMany = (gi: number, keys: string[]) => update((cur) => cur.map((g, i) => (i === gi ? { ...g, sources: g.sources.filter((x) => !keys.includes(x)) } : g)))
  const sourceChips = (sources: string[]) => {
    const left = new Set(sources)
    const chips: { id: string; label: string; keys: string[] }[] = []
    const ordered = [...groups.filter((p) => p.region), ...groups.filter((p) => !p.region)]
    for (const p of ordered) {
      if (p.items.length < 2) continue
      const members = p.items.map((x) => x.key).filter((k) => left.has(k))
      if (!members.length) continue
      members.forEach((k) => left.delete(k))
      chips.push({ id: `g:${p.label}`, label: members.length === p.items.length ? `${p.label} ${t('전체', 'all')}` : `${p.label} (${members.length}/${p.items.length})`, keys: members })
    }
    for (const k of left) chips.push({ id: k, label: names.get(k) ?? k, keys: [k] })
    return chips
  }
  const removeKeyword = (gi: number, k: string) => update((cur) => cur.map((g, i) => (i === gi ? { ...g, keywords: g.keywords.filter((x) => x !== k) } : g)))
  const addKeywords = (raw: string) => {
    const words = raw.split(/[,\n]/).map((w) => w.replace(/[,()*%\\"]/g, '').trim().slice(0, 30)).filter(Boolean)
    if (!words.length) return
    update((cur) => cur.map((g, i) => {
      if (i !== active) return { ...g, keywords: g.keywords.filter((k) => !words.includes(k)) }
      const merged = [...g.keywords]
      for (const w of words) if (!merged.includes(w) && merged.length < PRESS_TIER_MAX_KEYWORDS) merged.push(w)
      return { ...g, keywords: merged }
    }))
  }
  const setLimit = (gi: number, n: number) => update((cur) => cur.map((g, i) => (i === gi ? { ...g, limit: Math.max(1, Math.min(PRESS_TIER_MAX_LIMIT, n || 1)) } : g)))

  // 목록 보기: 체크한 출처의 자료만 아래에 보인다 (주소를 바꿔 다시 불러온다)
  const go = (keys: string[]) => {
    const sp = new URLSearchParams({ tab: 'all' })
    if (q) sp.set('q', q)
    keys.forEach((k) => sp.append('s', k))
    router.push(`/press?${sp.toString()}`)
  }
  const viewToggleOne = (key: string) => go(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key])
  const viewToggleMany = (keys: string[]) => go(keys.every((k) => selected.includes(k)) ? selected.filter((k) => !keys.includes(k)) : Array.from(new Set([...selected, ...keys])))

  const isOn = (key: string) => (grouping ? owner.has(key) : selected.includes(key))
  const onOne = grouping ? toggleOne : viewToggleOne
  const onMany = grouping ? toggleMany : viewToggleMany
  const badge = (key: string) => {
    const g = owner.get(key)
    return g === undefined ? null : <span className={`rounded px-1.5 text-[10.5px] font-bold leading-4 ${grouping && g === active ? 'bg-ink text-white' : 'bg-line text-ink'}`} title={t(`그룹 ${g + 1}`, `Group ${g + 1}`)}>{g + 1}</span>
  }

  // 컴포넌트가 아니라 함수로 그린다 (체크할 때마다 화면 조각이 새로 만들어져 포커스·열림 상태가 풀리지 않게)
  const renderItem = (x: PickItem) => (
    <label key={x.key} className="flex cursor-pointer items-center gap-1.5 text-[13px]">
      <input type="checkbox" checked={isOn(x.key)} onChange={() => onOne(x.key)} />
      {x.name}
      {x.saved && <span className="text-[#B7791F]" title={t('그룹 없이 맞춤 자료에 넣어 둔 출처', 'Added to My feed without a group')}>★</span>}
      {badge(x.key)}
      {x.auto && <span className="text-[11px] text-muted">{t('(분야 설정)', '(field setting)')}</span>}
    </label>
  )

  const renderRegion = (g: PickGroup) => {
    const keys = g.items.map((x) => x.key)
    const on = keys.filter(isOn).length
    const mine = grouping ? keys.filter((k) => owner.get(k) === active).length : on
    return (
      <details key={g.label} open={on > 0 || undefined} className="rounded-md border border-line bg-white">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-[13px] [&::-webkit-details-marker]:hidden">
          <input
            type="checkbox"
            aria-label={`${g.label} ${t('전체 선택', 'Select all')}`}
            checked={mine === keys.length}
            ref={(el) => { if (el) el.indeterminate = on > 0 && mine < keys.length }}
            onClick={(e) => e.stopPropagation()}
            onChange={() => onMany(keys)}
          />
          <span className="font-semibold">{g.label}</span>
          <span className="text-[12px] text-muted">{on > 0 ? `${on}/${keys.length}` : keys.length}</span>
        </summary>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line px-3 py-2.5">
          {g.items.map(renderItem)}
        </div>
      </details>
    )
  }

  return (
    <section className="border-b border-line bg-[#FAFAF7] px-4 py-4 md:px-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[14px] font-bold">{t('맞춤 자료 만들기', 'Build My feed')}</h2>
        {canPick && outletId && (
          <div className="inline-flex overflow-hidden rounded-md border border-line text-[12.5px]" role="tablist" aria-label={t('작업 선택', 'Mode')}>
            <button type="button" role="tab" aria-selected={mode === 'group'} onClick={() => setMode('group')} className={`px-3 py-1.5 ${mode === 'group' ? 'bg-ink font-semibold text-white' : 'bg-white text-muted hover:text-ink'}`}>{t('그룹에 담기', 'Fill groups')}</button>
            <button type="button" role="tab" aria-selected={mode === 'view'} onClick={() => setMode('view')} className={`px-3 py-1.5 ${mode === 'view' ? 'bg-ink font-semibold text-white' : 'bg-white text-muted hover:text-ink'}`}>{t('출처별 목록 보기', 'Browse by source')}</button>
          </div>
        )}
      </div>

      {grouping ? (
        <>
          <p className="mb-2 text-[12.5px] leading-relaxed text-muted">
            <b className="text-ink">① {t('담을 그룹을 누르세요', 'Pick a group')}</b> → <b className="text-ink">② {t('아래에서 출처를 체크하면 바로 그 그룹에 담깁니다', 'check sources below and they go into that group right away')}</b>. {t('그룹 1이 맞춤 자료 맨 위에 나오고, 건수는 그 그룹에서 출처·키워드 하나당 보이는 최신 자료 수입니다. 체크를 다시 풀면 그룹에서 빠집니다.', 'Group 1 appears at the top of My feed; the number is how many latest items each source/keyword in that group shows. Uncheck to remove.')}
          </p>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-4">
            {tiers.map((g, gi) => {
              const on = gi === active
              return (
                <div key={gi} className={`rounded-lg border bg-white p-2.5 ${on ? 'border-ink ring-1 ring-ink' : 'border-line'}`}>
                  <button type="button" onClick={() => setActive(gi)} aria-pressed={on} className="flex w-full items-center justify-between gap-2 text-left">
                    <span className="text-[13px] font-bold">{t(`그룹 ${gi + 1}`, `Group ${gi + 1}`)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${on ? 'bg-ink text-white' : 'bg-line text-muted'}`}>{on ? t('담는 중', 'Filling') : t('누르면 이 그룹에 담기', 'Tap to fill')}</span>
                  </button>
                  <label className="mt-1.5 flex items-center gap-1.5 text-[12px] text-muted">
                    {t('하나당 최신', 'Latest per item')}
                    <input type="number" min={1} max={PRESS_TIER_MAX_LIMIT} value={g.limit} onChange={(e) => setLimit(gi, Number(e.target.value))} className="field-input w-14 py-0.5 text-center" />
                    {t('건', '')}
                  </label>
                  <div className="mt-2 flex min-h-7 flex-wrap gap-1">
                    {g.sources.length === 0 && g.keywords.length === 0 && <span className="text-[12px] text-muted">{t('비어 있음', 'Empty')}</span>}
                    {sourceChips(g.sources).map((c) => (
                      <span key={c.id} className="inline-flex items-center gap-1 rounded-full border border-ink/30 bg-white py-0.5 pl-2 pr-0.5 text-[11.5px]">
                        {c.label}
                        <button type="button" onClick={() => removeMany(gi, c.keys)} aria-label={t(`${c.label} 빼기`, `Remove ${c.label}`)} className="grid h-4 w-4 place-items-center rounded-full text-[11px] text-muted hover:bg-ink hover:text-white">×</button>
                      </span>
                    ))}
                    {g.keywords.map((k) => (
                      <span key={k} className="inline-flex items-center gap-1 rounded-full bg-ink/10 py-0.5 pl-2 pr-0.5 text-[11.5px]">
                        # {k}
                        <button type="button" onClick={() => removeKeyword(gi, k)} aria-label={t(`${k} 빼기`, `Remove ${k}`)} className="grid h-4 w-4 place-items-center rounded-full text-[11px] text-muted hover:bg-ink hover:text-white">×</button>
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeywords(draft); setDraft('') } }}
              placeholder={t(`키워드도 그룹 ${active + 1}에 담기 (입력 후 Enter, 쉼표로 여러 개)`, `Add keywords to group ${active + 1} (Enter, comma for several)`)}
              maxLength={120}
              className="field-input min-w-0 flex-1 py-1 text-[12.5px] md:max-w-sm"
            />
            <button type="button" onClick={() => { addKeywords(draft); setDraft('') }} className="btn-secondary px-3 py-1 text-[12px]">{t('추가', 'Add')}</button>
            <span role="status" className="text-[12px] text-muted">
              {status === 'saving' && t('저장 중…', 'Saving…')}
              {status === 'saved' && <span className="font-semibold text-published">{t('저장됨 ✓', 'Saved ✓')}</span>}
              {status === 'error' && <span className="font-semibold text-danger">{err}</span>}
            </span>
          </div>
        </>
      ) : (
        <p className="mb-2 text-[12.5px] leading-relaxed text-muted">{t('체크한 출처의 자료만 아래에 보입니다.', 'Only releases from the checked sources are listed below.')}{selected.length > 0 && <> <button type="button" onClick={() => go([])} className="font-semibold underline">{t('선택 해제', 'Clear')}</button></>}</p>
      )}

      <div className="mt-3 space-y-3">
        {groups.filter((g) => !g.region).map((g) => (
          <fieldset key={g.label}>
            <legend className="mb-1.5 text-[12px] font-bold text-muted">{g.label}</legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">{g.items.map(renderItem)}</div>
          </fieldset>
        ))}
        {grouping && kwList.length > 0 && (
          <fieldset>
            <legend className="mb-1.5 text-[12px] font-bold text-muted">{t('키워드', 'Keywords')} <span className="font-normal">{t('제목·요약에 이 단어가 있는 자료 (모든 출처에서 찾습니다)', 'Releases whose title or summary contains the word (searched in all sources)')}</span></legend>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {kwList.map((k) => {
                const g = kwOwner.get(k)
                return (
                  <label key={k} className="flex cursor-pointer items-center gap-1.5 text-[13px]">
                    <input type="checkbox" checked={g !== undefined} onChange={() => toggleKeyword(k)} />
                    {k}
                    {g !== undefined && <span className={`rounded px-1.5 text-[10.5px] font-bold leading-4 ${g === active ? 'bg-ink text-white' : 'bg-line text-ink'}`}>{g + 1}</span>}
                  </label>
                )
              })}
            </div>
          </fieldset>
        )}
        {groups.some((g) => g.region && g.section !== 'world') && (
          <fieldset>
            <legend className="mb-1.5 text-[12px] font-bold text-muted">{t('지자체', 'Local government')} <span className="font-normal">{t('광역을 체크하면 아래 시·군·구가 모두 체크됩니다. 빼고 싶은 곳만 체크를 풀어 주세요.', 'Check a region to select all its cities and districts, then uncheck the ones you don’t want.')}</span></legend>
            <div className="grid gap-1.5">{groups.filter((g) => g.region && g.section !== 'world').map(renderRegion)}</div>
          </fieldset>
        )}
        {groups.some((g) => g.region && g.section === 'world') && (
          <fieldset>
            <legend className="mb-1.5 text-[12px] font-bold text-muted">{t('해외 뉴스 (미국 외)', 'World news (non-US)')} <span className="font-normal">{t('나라·분야별로 묶었습니다. 위 체크로 한꺼번에 선택하고 일부만 뺄 수 있습니다.', 'Grouped by country/topic. Check the top box to select all, then uncheck any.')}</span></legend>
            <div className="grid gap-1.5">{groups.filter((g) => g.region && g.section === 'world').map(renderRegion)}</div>
          </fieldset>
        )}
      </div>
    </section>
  )
}
