'use client'

import { useState, useTransition } from 'react'
import { saveMailSections } from '@/app/(main)/press/email/actions'
import { MAIL_SECTION_DEFAULT_LIMIT, type MailSectionConf } from '@/lib/press-mail-sections'
import { useT } from '@/components/cms/CmsLang'

// 메일로 온 보도자료를 섹션별로 나눠 받기: 섹션마다 키워드와 하루 받을 건수. 어디에도 안 맞으면 "미분류"
export default function PressMailSections({ outletId, initial, suggested, usage }: { outletId: string; initial: MailSectionConf; suggested: string[]; usage: Record<string, number> }) {
  const t = useT()
  const [conf, setConf] = useState<MailSectionConf>(initial)
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ text: string; error?: boolean }>({ text: '' })

  const setSec = (i: number, patch: Partial<MailSectionConf['sections'][number]>) => setConf((c) => ({ ...c, sections: c.sections.map((s, j) => (j === i ? { ...s, ...patch } : s)) }))
  const addSuggested = () => setConf((c) => ({ ...c, sections: [...c.sections, ...suggested.filter((n) => !c.sections.some((s) => s.name === n)).map((name) => ({ name, keywords: [name], limit: MAIL_SECTION_DEFAULT_LIMIT }))] }))
  const save = () => start(async () => {
    const r = await saveMailSections(outletId, conf)
    setMsg(r.error ? { text: r.error, error: true } : { text: conf.sections.length ? t('저장했습니다. 지금부터 오는 메일에 적용됩니다.', 'Saved. It applies to emails that arrive from now on.') : t('분류를 껐습니다. 모든 메일을 그대로 받습니다.', 'Sorting is off. All emails are received as before.') })
  })

  return (
    <section className="mt-8 rounded-lg border border-line bg-white p-4 md:p-5">
      <h2 className="text-[16px] font-bold">{t('메일 보도자료 섹션별로 나눠 받기', 'Sort emailed press releases by section')}</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">
        {t('메일 제목·본문에 키워드가 들어 있으면 그 섹션으로 분류하고, 어디에도 안 맞으면 "미분류"로 받습니다. 섹션마다 하루에 받을 건수를 정하면 넘는 메일은 받지 않습니다. 매체 전체 하루 한도(100건)는 그대로 적용됩니다. 한 곳도 만들지 않으면 지금처럼 모두 받습니다.',
          'If an email’s title or body contains a keyword, it goes to that section; otherwise it is "Unsorted". Set a daily count per section — emails over it are not received. The outlet-wide daily cap (100) still applies. With no sections, every email is received as before.')}
      </p>
      <ul className="mt-3 space-y-2">
        {conf.sections.map((s, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 rounded border border-line px-2.5 py-2 text-[13px]">
            <input value={s.name} onChange={(e) => setSec(i, { name: e.target.value })} aria-label={t('섹션 이름', 'Section name')} className="w-28 rounded border border-line px-2 py-1 font-semibold" />
            <input value={s.keywords.join(', ')} onChange={(e) => setSec(i, { keywords: e.target.value.split(/[,，]/).map((k) => k.trim()).filter(Boolean) })} placeholder={t('키워드 (쉼표로 구분)', 'Keywords (comma separated)')} aria-label={t('키워드', 'Keywords')} className="min-w-[160px] flex-1 rounded border border-line px-2 py-1" />
            <label className="flex items-center gap-1 text-muted">{t('하루', 'Per day')}
              <input type="number" min={0} max={100} value={s.limit} onChange={(e) => setSec(i, { limit: Number(e.target.value) })} className="w-16 rounded border border-line px-2 py-1 text-ink" />{t('건', '')}
            </label>
            <span className="text-[12px] text-muted">{t(`오늘 ${usage[s.name] ?? 0}건`, `${usage[s.name] ?? 0} today`)}</span>
            <button type="button" onClick={() => setConf((c) => ({ ...c, sections: c.sections.filter((_, j) => j !== i) }))} className="text-[12px] text-muted underline">{t('삭제', 'Remove')}</button>
          </li>
        ))}
        <li className="flex flex-wrap items-center gap-2 rounded border border-dashed border-line px-2.5 py-2 text-[13px] text-muted">
          <span className="w-28 font-semibold text-ink">{t('미분류', 'Unsorted')}</span>
          <span className="flex-1">{t('어느 섹션에도 안 맞는 메일', 'Emails matching no section')}</span>
          <label className="flex items-center gap-1">{t('하루', 'Per day')}
            <input type="number" min={0} max={100} value={conf.otherLimit} onChange={(e) => setConf((c) => ({ ...c, otherLimit: Number(e.target.value) }))} className="w-16 rounded border border-line px-2 py-1 text-ink" />{t('건', '')}
          </label>
          <span className="text-[12px]">{t(`오늘 ${usage['미분류'] ?? 0}건`, `${usage['미분류'] ?? 0} today`)}</span>
        </li>
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setConf((c) => ({ ...c, sections: [...c.sections, { name: '', keywords: [], limit: MAIL_SECTION_DEFAULT_LIMIT }] }))} className="btn-secondary px-3 py-1 text-[12.5px]">{t('+ 섹션 추가', '+ Add section')}</button>
        {suggested.length > 0 && <button type="button" onClick={addSuggested} className="btn-secondary px-3 py-1 text-[12.5px]">{t('우리 매체 섹션 가져오기', 'Import my sections')}</button>}
        <button type="button" disabled={pending} onClick={save} className="btn-primary ml-auto px-3.5 py-1.5 text-[12.5px] disabled:opacity-40">{pending ? t('저장 중…', 'Saving…') : t('저장', 'Save')}</button>
      </div>
      {msg.text && <p className={`mt-2 text-[12.5px] ${msg.error ? 'text-danger' : 'text-published'}`} role="status">{msg.text}</p>}
    </section>
  )
}
