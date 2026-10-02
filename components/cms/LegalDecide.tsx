'use client'

import { useState } from 'react'
import { LEGAL_TYPE_LABEL, RISK_LABEL, type LegalCheck } from '@/lib/legal-types'
import { RISK_TONE, SEV, SEV_LABEL } from './LegalReview'

export type Decision = 'fixed' | 'kept'

// AI 법적 검수 확인창: 항목마다 "AI 문장으로 바꾸기 / 그대로 두기"를 고르고 바로 다음 단계로 넘어간다.
// fixable[i] = 기사에서 그 문장을 찾아 바로 바꿀 수 있는지
export default function LegalDecide({ check, fixable, next, onDone, onEdit }: {
  check: LegalCheck
  fixable: boolean[]
  next: string
  onDone: (decisions: Decision[]) => void
  onEdit: () => void
}) {
  // 기본값: 바꿀 수 있는 위험·주의 항목은 바꾸기, 참고 항목은 그대로
  const [picks, setPicks] = useState<Decision[]>(() =>
    check.issues.map((x, i) => (fixable[i] && x.severity !== 'low' ? 'fixed' : 'kept'))
  )
  const fixCount = picks.filter((p, i) => p === 'fixed' && fixable[i]).length
  const set = (i: number, d: Decision) => setPicks((p) => p.map((v, j) => (j === i ? d : v)))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-[12px] font-bold ${RISK_TONE[check.risk]}`}>법적 위험 {RISK_LABEL[check.risk]}</span>
        <p className="min-w-0 flex-1 text-[13.5px]">{check.summary}</p>
      </div>
      {check.reused && <p className="text-[12px] text-muted">앞서 검수한 뒤로 제목·본문이 바뀌지 않아 그때 결과를 그대로 보여 드립니다.</p>}

      {check.issues.length === 0 && (
        <p className="rounded-lg border border-published/30 bg-published/5 px-4 py-3 text-[13.5px] font-medium text-published">문제가 될 만한 표현을 찾지 못했습니다.</p>
      )}
      <ol className="space-y-2">
        {check.issues.map((x, i) => {
          const pick = picks[i]
          return (
            <li key={i} className={`rounded-lg border px-4 py-3 text-[13px] leading-relaxed ${SEV[x.severity] ?? SEV.low}`}>
              <p className="flex flex-wrap items-center gap-2 text-[12px] font-bold">
                <span>{LEGAL_TYPE_LABEL[x.type] ?? x.type}</span>
                <span className="font-semibold text-muted">· {SEV_LABEL[x.severity] ?? x.severity}</span>
              </p>
              {x.quote && <blockquote className={`mt-1.5 border-l-2 border-ink/30 pl-3 ${fixable[i] && pick === 'fixed' ? 'text-muted line-through decoration-danger/60' : 'text-ink'}`}>“{x.quote}”</blockquote>}
              {fixable[i] && (
                <p className={`mt-1 border-l-2 border-published pl-3 ${pick === 'fixed' ? 'font-medium text-ink' : 'text-muted'}`}>
                  <span className="mr-1 text-[11.5px] font-bold text-published">바꿀 문장</span>“{x.fix}”
                </p>
              )}
              <p className="mt-1.5"><strong className="font-semibold">이유</strong> {x.reason}</p>
              {x.suggestion && <p className="mt-0.5"><strong className="font-semibold">고치는 방법</strong> {x.suggestion}</p>}

              {fixable[i] ? (
                <div role="radiogroup" aria-label="이 항목 처리" className="mt-2.5 inline-flex rounded-md border border-line bg-white p-0.5 text-[12.5px] font-semibold">
                  {([['fixed', 'AI 문장으로 바꾸기'], ['kept', '그대로 두기']] as const).map(([d, label]) => (
                    <button
                      key={d}
                      type="button"
                      role="radio"
                      aria-checked={pick === d}
                      onClick={() => set(i, d)}
                      className={`rounded px-3 py-1.5 transition ${pick === d ? (d === 'fixed' ? 'bg-published text-white' : 'bg-ink text-white') : 'text-muted hover:text-ink'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[12px] text-muted">문장 바꾸기로 해결되지 않는 항목입니다. 직접 고치거나, 확인했다면 그대로 진행하세요.</p>
              )}
            </li>
          )
        })}
      </ol>
      <p className="text-[11.5px] leading-relaxed text-muted">AI 검수는 참고용이며 법률 자문이 아닙니다. 인터넷에서 다른 기사와 똑같은지까지 대조하지는 않으니, 다른 매체 글을 옮겼다면 출처를 꼭 밝혀 주세요.</p>

      <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-wrap items-center justify-end gap-2 border-t border-line bg-white px-5 py-4 md:-mx-7 md:-mb-7 md:px-7">
        {check.issues.length > 0 && (
          <>
            <p className="mr-auto text-[12.5px] text-muted">
              {fixCount ? <><strong className="text-ink">{fixCount}곳</strong>을 AI 문장으로 바꿉니다</> : '바꾸는 곳 없이 그대로 둡니다'}
            </p>
            <button type="button" onClick={onEdit} className="btn-secondary">직접 고치기</button>
          </>
        )}
        <button type="button" onClick={() => onDone(picks.map((p, i) => (fixable[i] ? p : 'kept')))} className="btn-primary px-5" autoFocus>
          {fixCount ? '바꾸고 ' : ''}{next}
        </button>
      </div>
    </div>
  )
}
