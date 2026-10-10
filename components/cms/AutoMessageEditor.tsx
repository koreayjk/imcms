'use client'

import { useState, useTransition } from 'react'
import { saveAutoMessage } from '@/app/(main)/admin/leads/actions'

// 무료 체험 5일째 자동 안내: 켜고 끄기·문구 고치기
export default function AutoMessageEditor({ initial }: { initial: { title: string; body: string; enabled: boolean } }) {
  const [v, setV] = useState(initial)
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const [pending, start] = useTransition()

  function save(next = v) {
    setMsg('')
    start(async () => {
      const r = await saveAutoMessage(next)
      setMsg(r.error ?? '저장했습니다.')
    })
  }

  return (
    <section className="mb-4 rounded-lg border border-[#2F6BF0]/25 bg-[#2F6BF0]/5 px-5 py-4" aria-label="체험 5일째 자동 안내">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14.5px] font-bold">체험 5일째 자동 안내 <span className={`ml-1 rounded px-1.5 py-0.5 text-[11.5px] ${v.enabled ? 'bg-published/15 text-published' : 'bg-line text-muted'}`}>{v.enabled ? '켜짐' : '꺼짐'}</span></p>
          <p className="mt-0.5 text-[12.5px] text-muted">체험이 이틀 남은 날 아침 10시쯤, 체험자에게 고객센터 &lsquo;운영팀 안내&rsquo;와 알림 메일이 갑니다. 이미 안내를 받은 분은 건너뜁니다. {'{이름}'}은 받는 분 이름으로 바뀝니다.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" disabled={pending} onClick={() => { const n = { ...v, enabled: !v.enabled }; setV(n); save(n) }} className="rounded-full border border-line bg-white px-3.5 py-1.5 text-[13px] font-semibold hover:border-ink">{v.enabled ? '끄기' : '켜기'}</button>
          <button type="button" onClick={() => setOpen(!open)} className="rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-semibold text-white">{open ? '닫기' : '문구 고치기'}</button>
        </div>
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          <label htmlFor="am-title" className="sr-only">제목</label>
          <input id="am-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} maxLength={200} className="field-input bg-white" />
          <label htmlFor="am-body" className="sr-only">내용</label>
          <textarea id="am-body" value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} rows={14} className="field-input resize-y bg-white leading-relaxed" />
          <div className="flex items-center justify-end gap-3">
            {msg && <span role="status" className="text-[12.5px] text-muted">{msg}</span>}
            <button type="button" disabled={pending} onClick={() => save()} className="btn-primary">{pending ? '저장 중…' : '저장'}</button>
          </div>
        </div>
      )}
      {!open && msg && <p role="status" className="mt-2 text-[12.5px] text-muted">{msg}</p>}
    </section>
  )
}
