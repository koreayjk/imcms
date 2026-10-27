'use client'

import { useState, useTransition } from 'react'
import { useT } from './CmsLang'
import { saveAutoMessage } from '@/app/(main)/admin/leads/actions'

// 무료 체험 5일째 자동 안내: 켜고 끄기·문구 고치기
export default function AutoMessageEditor({ initial }: { initial: { title: string; body: string; enabled: boolean } }) {
  const t = useT()
  const [v, setV] = useState(initial)
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState('')
  const [pending, start] = useTransition()

  function save(next = v) {
    setMsg('')
    start(async () => {
      const r = await saveAutoMessage(next)
      setMsg(r.error ?? t('저장했습니다.', 'Saved.'))
    })
  }

  return (
    <section className="mb-4 rounded-lg border border-[#2F6BF0]/25 bg-[#2F6BF0]/5 px-5 py-4" aria-label={t('체험 5일째 자동 안내', 'Day-5 trial automatic notice')}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14.5px] font-bold">{t('체험 5일째 자동 안내', 'Day-5 trial automatic notice')} <span className={`ml-1 rounded px-1.5 py-0.5 text-[11.5px] ${v.enabled ? 'bg-published/15 text-published' : 'bg-line text-muted'}`}>{v.enabled ? t('켜짐', 'On') : t('꺼짐', 'Off')}</span></p>
          <p className="mt-0.5 text-[12.5px] text-muted">{t('체험이 이틀 남은 날 아침 10시쯤, 체험자에게 고객센터 ‘운영팀 안내’와 알림 메일이 갑니다. 이미 안내를 받은 분은 건너뜁니다. ', 'About 10 a.m. on the day two days remain in the trial, the trial user receives an \'IM Newsroom team notice\' in Customer Support and an email alert. Anyone who has already received the notice is skipped. ')}{'{이름}'}{t('은 받는 분 이름으로 바뀝니다.', ' is replaced with the recipient\'s name.')}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button type="button" disabled={pending} onClick={() => { const n = { ...v, enabled: !v.enabled }; setV(n); save(n) }} className="rounded-full border border-line bg-white px-3.5 py-1.5 text-[13px] font-semibold hover:border-ink">{v.enabled ? t('끄기', 'Turn off') : t('켜기', 'Turn on')}</button>
          <button type="button" onClick={() => setOpen(!open)} className="rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-semibold text-white">{open ? t('닫기', 'Close') : t('문구 고치기', 'Edit message')}</button>
        </div>
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          <label htmlFor="am-title" className="sr-only">{t('제목', 'Title')}</label>
          <input id="am-title" value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} maxLength={200} className="field-input bg-white" />
          <label htmlFor="am-body" className="sr-only">{t('내용', 'Body')}</label>
          <textarea id="am-body" value={v.body} onChange={(e) => setV({ ...v, body: e.target.value })} rows={14} className="field-input resize-y bg-white leading-relaxed" />
          <div className="flex items-center justify-end gap-3">
            {msg && <span role="status" className="text-[12.5px] text-muted">{msg}</span>}
            <button type="button" disabled={pending} onClick={() => save()} className="btn-primary">{pending ? t('저장 중…', 'Saving…') : t('저장', 'Save')}</button>
          </div>
        </div>
      )}
      {!open && msg && <p role="status" className="mt-2 text-[12.5px] text-muted">{msg}</p>}
    </section>
  )
}
