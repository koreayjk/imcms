'use client'

import { useRef } from 'react'

// 보도자료함 "전체" 탭의 출처 체크 목록
//   체크하면 바로 그 출처의 자료만 아래에 보인다 (누구나). 편집장 이상은 체크한 출처를 맞춤 자료에 넣거나 뺄 수 있다.
// 서버 동작에 "무슨 버튼을 눌렀는지(mode)"를 직접 담아 보낸다 (버튼의 name·value 는 서버 동작 호출에서 빠질 수 있다)
const withMode = (action: (formData: FormData) => void | Promise<void>, mode: string) => async (formData: FormData) => {
  formData.set('mode', mode)
  await action(formData)
}

export type PickGroup = { label: string; items: { key: string; name: string; saved: boolean; auto: boolean; tier?: number }[]; region?: boolean }

export default function PressSourceFilter({ groups, selected, q, canPick, saveAction, tierAction, text }: {
  groups: PickGroup[]
  selected: string[]
  q?: string
  canPick: boolean
  saveAction: (formData: FormData) => void | Promise<void>
  tierAction: (formData: FormData) => void | Promise<void>
  text: { title: string; hint: string; clear: string; add: string; remove: string; only: string; savedMark: string; autoMark: string; editorOnly: string; open: string; close: string; regionHint?: string; regionAll?: string; tierHint: string; tierAdd: string[]; tierRemove: string; tierMark: string }
}) {
  const form = useRef<HTMLFormElement>(null)
  return (
    <details open className="group border-b border-line bg-[#FAFAF7]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-[13px] font-semibold md:px-5 [&::-webkit-details-marker]:hidden">
        <span>{text.title} <span className="ml-1 font-normal text-muted">{text.hint}</span></span>
        <span className="text-[12px] font-normal text-muted group-open:hidden">{text.open}</span>
        <span className="hidden text-[12px] font-normal text-muted group-open:inline">{text.close}</span>
      </summary>
      <form ref={form} method="get" action="/press" className="px-4 pb-4 md:px-5" onChange={() => form.current?.requestSubmit()}>
        <input type="hidden" name="tab" value="all" />
        {q && <input type="hidden" name="q" value={q} />}
        <div className="space-y-3">
          {groups.filter((g) => !g.region).map((g) => (
            <fieldset key={g.label}>
              <legend className="mb-1.5 text-[12px] font-bold text-muted">{g.label}</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {g.items.map((x) => <Item key={x.key} x={x} checked={selected.includes(x.key)} text={text} />)}
              </div>
            </fieldset>
          ))}
          {groups.some((g) => g.region) && (
            <fieldset>
              <legend className="mb-1.5 text-[12px] font-bold text-muted">지자체 <span className="font-normal">{text.regionHint}</span></legend>
              <div className="grid gap-1.5">
                {groups.filter((g) => g.region).map((g) => <Region key={g.label} g={g} selected={selected} text={text} />)}
              </div>
            </fieldset>
          )}
        </div>
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          {selected.length > 0 && <a href={q ? `/press?tab=all&q=${encodeURIComponent(q)}` : '/press?tab=all'} className="btn-secondary px-3 py-1.5 text-[12.5px]">{text.clear}</a>}
          {canPick ? (
            <>
              <button type="submit" formAction={withMode(saveAction, 'add')} disabled={!selected.length} className="btn-primary px-3 py-1.5 text-[12.5px] disabled:opacity-40">{text.add}</button>
              <button type="submit" formAction={withMode(saveAction, 'remove')} disabled={!selected.length} className="btn-secondary px-3 py-1.5 text-[12.5px] disabled:opacity-40">{text.remove}</button>
            </>
          ) : <span className="text-[12px] text-muted">{text.editorOnly}</span>}
          <span className="text-[12px] text-muted">{text.only}</span>
        </div>
        {canPick && (
          <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-md border border-line bg-white px-3 py-2.5">
            <span className="text-[12.5px] font-bold">{text.tierHint}</span>
            {text.tierAdd.map((label, i) => (
              <button key={i} type="submit" formAction={withMode(tierAction, `g${i + 1}`)} disabled={!selected.length} className="btn-secondary px-3 py-1.5 text-[12.5px] disabled:opacity-40">{label}</button>
            ))}
            <button type="submit" formAction={withMode(tierAction, 'ungroup')} disabled={!selected.length} className="px-2 py-1.5 text-[12.5px] text-muted underline disabled:opacity-40">{text.tierRemove}</button>
          </div>
        )}
      </form>
    </details>
  )
}

type Text = Parameters<typeof PressSourceFilter>[0]['text']

function Item({ x, checked, text }: { x: PickGroup['items'][number]; checked: boolean; text: Text }) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-[13px]">
      <input type="checkbox" name="s" value={x.key} defaultChecked={checked} />
      {x.name}
      {x.saved && <span className="text-[#B7791F]" title={text.savedMark}>★</span>}
      {x.tier && <span className="rounded bg-ink px-1.5 text-[10.5px] font-bold leading-4 text-white" title={text.tierMark}>{x.tier}</span>}
      {x.auto && <span className="text-[11px] text-muted">{text.autoMark}</span>}
    </label>
  )
}

// 광역(특별시·광역시·도) 한 묶음: 맨 위 체크로 아래 시·군·구를 한꺼번에 체크하고, 일부만 풀 수 있다 (일부만 체크되면 가운데 줄 표시)
function Region({ g, selected, text }: { g: PickGroup; selected: string[]; text: Text }) {
  const box = useRef<HTMLDivElement>(null)
  const on = g.items.filter((x) => selected.includes(x.key)).length
  const saved = g.items.filter((x) => x.saved).length
  const grouped = g.items.filter((x) => x.tier).length
  const toggleAll = (checked: boolean) => {
    box.current?.querySelectorAll<HTMLInputElement>('input[name="s"]').forEach((el) => { el.checked = checked })
  }
  return (
    <details open={on > 0 || undefined} className="rounded-md border border-line bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-[13px] [&::-webkit-details-marker]:hidden">
        <input
          type="checkbox"
          aria-label={`${g.label} ${text.regionAll ?? ''}`}
          defaultChecked={on === g.items.length}
          ref={(el) => { if (el) el.indeterminate = on > 0 && on < g.items.length }}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => toggleAll(e.currentTarget.checked)}
        />
        <span className="font-semibold">{g.label}</span>
        <span className="text-[12px] text-muted">{on > 0 ? `${on}/${g.items.length}` : g.items.length}</span>
        {saved > 0 && <span className="text-[#B7791F]" title={text.savedMark}>★ {saved}</span>}
        {grouped > 0 && <span className="rounded bg-ink px-1.5 text-[10.5px] font-bold leading-4 text-white" title={text.tierMark}>{grouped}</span>}
      </summary>
      <div ref={box} className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line px-3 py-2.5">
        {g.items.map((x) => <Item key={x.key} x={x} checked={selected.includes(x.key)} text={text} />)}
      </div>
    </details>
  )
}
