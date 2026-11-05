'use client'

import { useRef } from 'react'

// 보도자료함 "전체" 탭의 출처 체크 목록
//   체크하면 바로 그 출처의 자료만 아래에 보인다 (누구나). 편집장 이상은 체크한 출처를 맞춤 자료에 넣거나 뺄 수 있다.
export type PickGroup = { label: string; items: { key: string; name: string; saved: boolean; auto: boolean }[] }

export default function PressSourceFilter({ groups, selected, q, canPick, saveAction, text }: {
  groups: PickGroup[]
  selected: string[]
  q?: string
  canPick: boolean
  saveAction: (formData: FormData) => void | Promise<void>
  text: { title: string; hint: string; clear: string; add: string; remove: string; only: string; savedMark: string; autoMark: string; editorOnly: string; open: string; close: string }
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
          {groups.map((g) => (
            <fieldset key={g.label}>
              <legend className="mb-1.5 text-[12px] font-bold text-muted">{g.label}</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {g.items.map((x) => (
                  <label key={x.key} className="flex cursor-pointer items-center gap-1.5 text-[13px]">
                    <input type="checkbox" name="s" value={x.key} defaultChecked={selected.includes(x.key)} />
                    {x.name}
                    {x.saved && <span className="text-[#B7791F]" title={text.savedMark}>★</span>}
                    {x.auto && <span className="text-[11px] text-muted">{text.autoMark}</span>}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          {selected.length > 0 && <a href={q ? `/press?tab=all&q=${encodeURIComponent(q)}` : '/press?tab=all'} className="btn-secondary px-3 py-1.5 text-[12.5px]">{text.clear}</a>}
          {canPick ? (
            <>
              <button type="submit" name="mode" value="add" formAction={saveAction} formMethod="post" disabled={!selected.length} className="btn-primary px-3 py-1.5 text-[12.5px] disabled:opacity-40">{text.add}</button>
              <button type="submit" name="mode" value="remove" formAction={saveAction} formMethod="post" disabled={!selected.length} className="btn-secondary px-3 py-1.5 text-[12.5px] disabled:opacity-40">{text.remove}</button>
            </>
          ) : <span className="text-[12px] text-muted">{text.editorOnly}</span>}
          <span className="text-[12px] text-muted">{text.only}</span>
        </div>
      </form>
    </details>
  )
}
