'use client'

import { useState, useTransition } from 'react'
import { saveOutletLimit, type OutletLimit } from '@/app/(main)/press/email/actions'

// 총관리자: 언론사마다 하루에 메일로 받을 수 있는 보도자료 수를 정한다 (한국 시간 0시에 새로 시작, 넘는 날은 받지 않음)
export default function PressMailLimits({ initial, defaultLimit }: { initial: OutletLimit[]; defaultLimit: number }) {
  const [rows, setRows] = useState(initial)
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ id?: string; text: string; error?: boolean }>({ text: '' })

  const save = (r: OutletLimit, raw: string) => {
    const n = raw.trim() === '' ? null : Number(raw)
    start(async () => {
      const res = await saveOutletLimit(r.outlet_id, n)
      if (res.error) return setMsg({ id: r.outlet_id, text: res.error, error: true })
      setRows((all) => all.map((x) => (x.outlet_id === r.outlet_id ? { ...x, daily_limit: n ?? defaultLimit, is_custom: n !== null } : x)))
      setMsg({ id: r.outlet_id, text: n === null ? `기본 한도(${defaultLimit}건)로 되돌렸습니다.` : `하루 ${n}건으로 저장했습니다.` })
    })
  }

  return (
    <section className="mt-6 rounded-lg border border-line bg-white p-4 sm:p-6">
      <h2 className="text-[15px] font-bold">언론사별 하루 한도 <span className="text-[12px] font-normal text-muted">(총관리자에게만 보입니다)</span></h2>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        언론사 한 곳이 메일로 받을 수 있는 보도자료 수입니다. 그날 한도를 넘으면 그날 오는 메일은 받지 않고, 다음 날 0시(한국 시간)부터 새로 오는 메일을 다시 한도까지 받습니다.
        칸을 비우고 저장하면 기본 한도({defaultLimit}건)로 돌아갑니다.
      </p>
      <ul className="mt-3 divide-y divide-line text-[13.5px]">
        {rows.map((r) => (
          <li key={r.outlet_id} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-2.5">
            <span className="min-w-[10rem] flex-1 font-semibold">{r.outlet_name}</span>
            <span className="tabular-nums text-muted">오늘 {r.used_today}/{r.daily_limit}건{r.dropped_today > 0 ? <b className="ml-1 text-danger">· 못 받음 {r.dropped_today}</b> : null}</span>
            <form className="flex items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); save(r, String(new FormData(e.currentTarget).get('limit') ?? '')) }}>
              <label className="sr-only" htmlFor={`lim-${r.outlet_id}`}>{r.outlet_name} 하루 한도</label>
              <input id={`lim-${r.outlet_id}`} name="limit" type="number" min={0} max={2000} defaultValue={r.is_custom ? r.daily_limit : ''} placeholder={String(defaultLimit)} className="field-input w-24 py-1 text-right" />
              <span className="text-muted">건</span>
              <button type="submit" disabled={pending} className="btn-secondary px-3 py-1 text-[12.5px]">저장</button>
            </form>
            {msg.id === r.outlet_id && <span role={msg.error ? 'alert' : 'status'} className={`w-full text-[12.5px] ${msg.error ? 'text-danger' : 'text-published'}`}>{msg.text}</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}
