'use client'

import { useState } from 'react'
import { useT } from '@/components/cms/CmsLang'

// 매체 정보 한 장: 항목마다 복사 버튼, 맨 위에 전체 복사 (포털 신청서에 붙여 넣는다)
export default function InfoSheet({ groups }: { groups: { title: string; rows: { label: string; value: string }[] }[] }) {
  const t = useT()
  const [done, setDone] = useState('')
  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setDone(key); window.setTimeout(() => setDone(''), 1800) } catch { setDone('') }
  }
  const all = groups.map((g) => `[${g.title}]\n${g.rows.map((r) => `${r.label}: ${r.value || '-'}`).join('\n')}`).join('\n\n')
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[12.5px] text-muted">{t('빈 항목(-)은 홈페이지 설정에서 채워 주세요.', 'Fill empty items (-) in your website settings.')}</p>
        <button type="button" onClick={() => void copy('all', all)} className="btn-primary px-3.5 py-1.5 text-[13px]">{done === 'all' ? t('복사했습니다', 'Copied') : t('전체 복사', 'Copy all')}</button>
      </div>
      <div className="space-y-5">
        {groups.map((g) => (
          <section key={g.title}>
            <h3 className="mb-1.5 text-[13px] font-bold text-muted">{g.title}</h3>
            <dl className="divide-y divide-line rounded-lg border border-line bg-white">
              {g.rows.map((r) => (
                <div key={r.label} className="grid grid-cols-[110px_1fr_auto] items-start gap-3 px-4 py-2.5 text-[13.5px] sm:grid-cols-[160px_1fr_auto]">
                  <dt className="text-muted">{r.label}</dt>
                  <dd className={`min-w-0 whitespace-pre-line break-words ${r.value ? '' : 'text-muted'}`}>{r.value || '-'}</dd>
                  {r.value ? <button type="button" onClick={() => void copy(r.label, r.value)} className="text-[12px] text-review underline underline-offset-2">{done === r.label ? t('복사됨', 'Copied') : t('복사', 'Copy')}</button> : <span />}
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  )
}
