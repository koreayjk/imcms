'use client'

import { useMemo, useState } from 'react'
import { GOV_KIND_LABEL, GOV_REGIONS, govChildLabel, govStripItems, govUrlByName, type GovPick } from '@/lib/local-gov'
import { useCmsLang, useT } from './CmsLang'

type Item = { name: string; img: string; url?: string }

// 로고 띠에 지자체(광역·시·군·구)를 한꺼번에 넣는 도구 — 운영팀 전용 (SiteSettingsForm 의 !self 에서만 보인다)
//   고른 곳은 "이름표" 로고와 시청 홈페이지 주소가 함께 들어가고, 공식 로고(CI)는 줄마다 '로고 바꾸기'로 바꾼다
export default function GovPicker({ items, onChange, max = 40 }: { items: Item[]; onChange: (items: Item[]) => void; max?: number }) {
  const t = useT()
  const lang = useCmsLang()
  const [region, setRegion] = useState(GOV_REGIONS.find((r) => r.id === 'gyeonggi')?.id ?? GOV_REGIONS[0].id)
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [note, setNote] = useState('')
  const r = GOV_REGIONS.find((x) => x.id === region)!
  const key = (slug: string | null, rid = r.id) => `${rid}|${slug ?? ''}`
  const toggle = (k: string) => setPicked((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })
  const countIn = (rid: string) => [...picked].filter((k) => k.startsWith(`${rid}|`)).length
  const allKeys = useMemo(() => r.children.map((c) => key(c.slug)), [r]) // eslint-disable-line react-hooks/exhaustive-deps
  const allOn = allKeys.length > 0 && allKeys.every((k) => picked.has(k))
  const setAll = (on: boolean) => setPicked((s) => { const n = new Set(s); for (const k of allKeys) { if (on) n.add(k); else n.delete(k) } return n })

  function add() {
    const picks: GovPick[] = [...picked].map((k) => { const [rid, slug] = k.split('|'); return { region: rid, slug: slug || null } })
    // 화면에 보이는 순서(광역 순서·가나다)대로
    const order = (p: GovPick) => GOV_REGIONS.findIndex((x) => x.id === p.region) * 1000 + (p.slug ? (GOV_REGIONS.find((x) => x.id === p.region)?.children.findIndex((c) => c.slug === p.slug) ?? 0) + 1 : 0)
    picks.sort((a, b) => order(a) - order(b))
    const have = new Set(items.map((i) => i.name))
    const add = govStripItems(picks).filter((i) => !have.has(i.name))
    const room = Math.max(0, max - items.length)
    const take = add.slice(0, room)
    onChange([...items, ...take])
    setPicked(new Set())
    setNote(t(
      `${take.length}곳을 넣었습니다.${add.length - take.length > 0 ? ` 로고 띠는 최대 ${max}개라서 ${add.length - take.length}곳은 못 넣었습니다.` : ''}${picks.length - add.length > 0 ? ` 이미 있는 ${picks.length - add.length}곳은 건너뛰었습니다.` : ''} 저장하면 홈페이지에 반영됩니다.`,
      `Added ${take.length}.${add.length - take.length > 0 ? ` The logo strip holds at most ${max}, so ${add.length - take.length} could not be added.` : ''}${picks.length - add.length > 0 ? ` Skipped ${picks.length - add.length} that were already there.` : ''} Save to publish the change to the website.`,
    ))
  }

  function fillUrls() {
    let n = 0
    const next = items.map((it) => {
      if (it.url) return it
      const u = govUrlByName(it.name)
      if (u) { n++; return { ...it, url: u } }
      return it
    })
    onChange(next)
    const left = next.filter((i) => !i.url).length
    setNote(t(`주소를 ${n}곳에 채웠습니다.${left ? ` 주소가 비어 있는 ${left}곳은 이름으로 못 찾았으니 직접 적어 주세요.` : ''}`, `Filled in the address for ${n}.${left ? ` Could not find ${left} with empty addresses by name, so please enter them yourself.` : ''}`))
  }

  return (
    <details className="mt-4 rounded-lg border border-line bg-[#F8F9FA] p-3 text-[13px]">
      <summary className="cursor-pointer font-bold">{t('지자체 불러오기', 'Load local governments')} <span className="font-normal text-muted">{t('(운영팀 전용 · 광역/시·군·구를 골라 한 번에 넣기)', '(IM Newsroom team only · pick metropolitan/provincial governments and cities/counties/districts and add them at once)')}</span></summary>
      <div className="mt-3 space-y-3">
        <p className="leading-relaxed text-muted">{lang === 'en'
          ? <>Choose a metropolitan or provincial government (special city, metropolitan city or province), check the cities, counties and districts, then press “Add to logo strip”. A <strong className="text-body">placeholder label</strong> logo and the city hall website address are added together. Replace each row&apos;s logo with the official logo (CI) using “Change logo”. If you uploaded the official logo files all at once with their names (e.g. Suwon-si.png), you can fill in only the addresses with “Auto-fill addresses” below.</>
          : <>광역(특별시·광역시·도)을 고르고 시·군·구에 체크한 뒤 “로고 띠에 넣기”를 누르세요. <strong className="text-body">이름표</strong> 로고와 시청 홈페이지 주소가 같이 들어갑니다. 공식 로고(CI)는 줄마다 “로고 바꾸기”로 바꾸세요. 공식 로고 파일을 이름(예: 수원시.png)으로 한꺼번에 올렸다면 아래 “주소 자동 채우기”로 주소만 채울 수 있습니다.</>}</p>
        {(Object.keys(GOV_KIND_LABEL) as (keyof typeof GOV_KIND_LABEL)[]).map((kind) => (
          <div key={kind}>
            <p className="mb-1 text-[12px] font-semibold text-muted">{lang === 'en' ? (kind === 'metro' ? 'Special cities & metropolitan cities' : 'Provinces & special self-governing provinces') : GOV_KIND_LABEL[kind]}</p>
            <div className="flex flex-wrap gap-1.5">
              {GOV_REGIONS.filter((x) => x.kind === kind).map((x) => (
                <button key={x.id} type="button" onClick={() => setRegion(x.id)} aria-pressed={region === x.id}
                  className={`rounded-full px-3 py-1 text-[12.5px] font-semibold ${region === x.id ? 'bg-ink text-white' : 'border border-line bg-white text-muted hover:border-ink/40'}`}>
                  {x.short}{countIn(x.id) > 0 && <span className="ml-1 rounded-full bg-[#FF4D2E] px-1.5 text-[11px] text-white">{countIn(x.id)}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
        <div className="rounded-lg border border-line bg-white p-3">
          <div className="flex flex-wrap items-center gap-3">
            <strong className="text-[14px]">{r.name}</strong>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={picked.has(key(null))} onChange={() => toggle(key(null))} /> {t(`${r.short} 자체`, `${r.short} itself`)}</label>
            {r.children.length > 0 && <label className="flex items-center gap-1.5"><input type="checkbox" checked={allOn} onChange={(e) => setAll(e.target.checked)} /> {t('아래 전체 선택', 'Select all below')} ({r.children.length})</label>}
          </div>
          {r.children.length > 0 && (
            <ul className="mt-2 grid gap-x-3 gap-y-1 sm:grid-cols-3 lg:grid-cols-4">
              {r.children.map((c) => (
                <li key={c.slug}>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" checked={picked.has(key(c.slug))} onChange={() => toggle(key(c.slug))} />
                    <span>{govChildLabel(r, c)}</span>
                    {!c.url && <span className="rounded bg-[#FEF3C7] px-1 text-[10.5px] text-[#92400E]">{t('주소 확인', 'Check address')}</span>}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={add} disabled={!picked.size} className="btn-primary px-4 py-1.5 text-[13px]">{t(`로고 띠에 넣기 (${picked.size}곳)`, `Add to logo strip (${picked.size})`)}</button>
          <button type="button" onClick={fillUrls} className="btn-secondary px-3 py-1.5 text-[13px]">{t('주소 자동 채우기', 'Auto-fill addresses')}</button>
          <span className="text-[12px] text-muted">{t(`지금 ${items.length} / ${max}개`, `Currently ${items.length} / ${max}`)}</span>
        </div>
        {note && <p role="status" className="text-[12.5px] text-published">{note}</p>}
      </div>
    </details>
  )
}
