'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { savePressTiers } from '@/app/(main)/press/actions'
import { useT } from '@/components/cms/CmsLang'
import { PRESS_TIER_DEFAULTS, PRESS_TIER_MAX_KEYWORDS, PRESS_TIER_MAX_LIMIT, type PressTier } from '@/lib/sites'

// 보도자료함 맞춤 자료 설정 (편집장 이상): 키워드를 4개 그룹으로 나누고, 그룹마다 키워드 하나당 가져올 최신 건수를 정한다
export default function PressTierSettings({ outletId, initial, suggestions, active }: { outletId: string; initial: PressTier[]; suggestions: string[]; active: boolean }) {
  const t = useT()
  const router = useRouter()
  const [tiers, setTiers] = useState<PressTier[]>(() => PRESS_TIER_DEFAULTS.map((d, i) => ({ keywords: initial[i]?.keywords ?? [], limit: initial[i]?.limit ?? d })))
  const [target, setTarget] = useState(0)
  const [draft, setDraft] = useState<string[]>(['', '', '', ''])
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({})
  const [pending, start] = useTransition()

  const used = new Set(tiers.flatMap((g) => g.keywords))
  const add = (gi: number, raw: string) => {
    const words = raw.split(/[,\n]/).map((w) => w.replace(/[,()*%\\"]/g, '').trim().slice(0, 30)).filter(Boolean)
    if (!words.length) return
    setTiers((cur) => cur.map((g, i) => {
      if (i !== gi) return { ...g, keywords: g.keywords.filter((k) => !words.includes(k)) }   // 같은 키워드는 한 그룹에만
      const merged = [...g.keywords]
      for (const w of words) if (!merged.includes(w) && merged.length < PRESS_TIER_MAX_KEYWORDS) merged.push(w)
      return { ...g, keywords: merged }
    }))
  }
  const remove = (gi: number, k: string) => setTiers((cur) => cur.map((g, i) => (i === gi ? { ...g, keywords: g.keywords.filter((x) => x !== k) } : g)))
  const setLimit = (gi: number, n: number) => setTiers((cur) => cur.map((g, i) => (i === gi ? { ...g, limit: Math.max(1, Math.min(PRESS_TIER_MAX_LIMIT, n || 1)) } : g)))
  const total = tiers.reduce((sum, g) => sum + g.keywords.length * g.limit, 0)

  const save = () => start(async () => {
    const r = await savePressTiers(outletId, tiers)
    setMsg(r)
    if (!r.error) router.refresh()
  })

  return (
    <section aria-labelledby="press-tier-title" className="border-b border-line">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left md:px-5">
        <span id="press-tier-title" className="text-[13.5px] font-bold">
          {t('맞춤 자료 그룹 설정', 'Custom feed groups')}
          <span className={`ml-2 rounded px-1.5 py-0.5 text-[11px] font-semibold ${active ? 'bg-published/10 text-published' : 'bg-line text-muted'}`}>{active ? t('사용 중', 'In use') : t('아직 안 정함', 'Not set')}</span>
        </span>
        <span className="text-[12px] text-muted">{open ? t('접기', 'Close') : t('펼치기', 'Open')}</span>
      </button>
      {open && (
        <div className="space-y-4 px-4 pb-5 md:px-5">
          <p className="text-[12.5px] leading-relaxed text-muted">
            {t('키워드를 4개 그룹으로 나눠 담으세요. 그룹마다 “키워드 하나당 최신 몇 건”을 정하면, 자료가 많은 키워드가 다른 키워드를 밀어내지 않고 중요도 순서대로 골고루 모입니다. 최근 14일, 제목·요약에 키워드가 있는 자료만 보입니다.', 'Put keywords into 4 groups and set how many latest items each keyword brings per group. A busy keyword can’t crowd out the others, and groups appear in order of importance. Only releases from the last 14 days whose title or summary contains the keyword are shown.')}
          </p>

          {suggestions.length > 0 && (
            <div>
              <p className="mb-1.5 flex flex-wrap items-center gap-2 text-[12px] font-semibold">
                {t('이 매체의 섹션·키워드를 눌러 담기 →', 'Tap a section or keyword to add →')}
                <label className="flex items-center gap-1 font-normal text-muted">
                  {t('담을 그룹', 'Group')}
                  <select value={target} onChange={(e) => setTarget(Number(e.target.value))} className="field-input w-24 py-0.5 text-[12px]">
                    {tiers.map((_, i) => <option key={i} value={i}>{t(`그룹 ${i + 1}`, `Group ${i + 1}`)}</option>)}
                  </select>
                </label>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button key={s} type="button" onClick={() => add(target, s)} className={`rounded-full border px-2.5 py-1 text-[12px] ${used.has(s) ? 'border-ink bg-ink/5 text-ink' : 'border-dashed border-line text-muted hover:border-ink hover:text-ink'}`}>{s}</button>
                ))}
              </div>
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {tiers.map((g, gi) => (
              <div key={gi} className="rounded-lg border border-line p-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[13px] font-bold">{t(`그룹 ${gi + 1}`, `Group ${gi + 1}`)}</h3>
                  <label className="flex items-center gap-1.5 text-[12px] text-muted">
                    {t('키워드당 최신', 'Latest per keyword')}
                    <input type="number" min={1} max={PRESS_TIER_MAX_LIMIT} value={g.limit} onChange={(e) => setLimit(gi, Number(e.target.value))} className="field-input w-16 py-0.5 text-center" />
                    {t('건', '')}
                  </label>
                </div>
                <div className="mt-2 flex min-h-8 flex-wrap gap-1.5">
                  {g.keywords.length === 0 && <span className="py-1 text-[12px] text-muted">{t('비어 있음', 'Empty')}</span>}
                  {g.keywords.map((k) => (
                    <span key={k} className="inline-flex items-center gap-1 rounded-full bg-ink/10 py-0.5 pl-2.5 pr-1 text-[12px]">
                      {k}
                      <button type="button" onClick={() => remove(gi, k)} aria-label={t(`${k} 빼기`, `Remove ${k}`)} className="grid h-4 w-4 place-items-center rounded-full text-[11px] text-muted hover:bg-ink hover:text-white">×</button>
                    </span>
                  ))}
                </div>
                <div className="mt-2 flex gap-1.5">
                  <input
                    value={draft[gi]}
                    onChange={(e) => setDraft((cur) => cur.map((d, i) => (i === gi ? e.target.value : d)))}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(gi, draft[gi]); setDraft((cur) => cur.map((d, i) => (i === gi ? '' : d))) } }}
                    placeholder={t('직접 입력 후 Enter (쉼표로 여러 개)', 'Type and press Enter (comma for several)')}
                    maxLength={120}
                    className="field-input min-w-0 flex-1 py-1 text-[12.5px]"
                  />
                  <button type="button" onClick={() => { add(gi, draft[gi]); setDraft((cur) => cur.map((d, i) => (i === gi ? '' : d))) }} className="btn-secondary px-3 py-1 text-[12px]">{t('추가', 'Add')}</button>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={save} disabled={pending} className="btn-primary px-4 py-2 text-[13px] disabled:opacity-60">{pending ? t('저장 중…', 'Saving…') : t('저장', 'Save')}</button>
            <span className="text-[12px] text-muted">{t(`최대 ${total}건까지 모입니다 (같은 자료는 한 번만)`, `Up to ${total} items (duplicates shown once)`)}</span>
            {msg.ok && <span role="status" className="text-[12.5px] font-semibold text-published">{msg.ok}</span>}
            {msg.error && <span role="alert" className="text-[12.5px] font-semibold text-danger">{msg.error}</span>}
          </div>
          <p className="text-[11.5px] text-muted">{t('그룹을 모두 비우고 저장하면 예전 추천 방식(매체 설정의 추천 키워드)으로 돌아갑니다.', 'Clear every group and save to go back to the default recommendation (the outlet’s keyword settings).')}</p>
        </div>
      )}
    </section>
  )
}
