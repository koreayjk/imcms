'use client'

import { LEGAL_TYPE_LABEL, RISK_LABEL, type LegalCheck, type LegalIssue } from '@/lib/legal-types'
import { formatDateTime } from '@/lib/format'
import type { CmsLang } from '@/lib/cms-i18n'
import { useCmsLang, useT } from './CmsLang'

export const SEV: Record<string, string> = {
  high: 'border-danger/40 bg-danger/5',
  medium: 'border-draft/50 bg-draft/10',
  low: 'border-line bg-paper',
}
export const SEV_LABEL: Record<string, string> = { high: '위험', medium: '주의', low: '참고' }
// 영어판 표시 이름 (lib/legal-types.ts 의 한국어 표는 그대로). 다른 화면(LegalDecide 등)도 이 도우미를 쓰면 된다
export const SEV_LABEL_EN: Record<string, string> = { high: 'High risk', medium: 'Caution', low: 'Note' }
export const RISK_LABEL_EN: Record<LegalCheck['risk'], string> = { low: 'Low', medium: 'Caution', high: 'High' }
export const LEGAL_TYPE_LABEL_EN: Record<LegalIssue['type'], string> = {
  defamation: 'Defamation', insult: 'Insult / disparagement', privacy: 'Privacy / image rights', copyright: 'Copyright / plagiarism',
  false_info: 'Fact-check needed', crime_report: 'Crime / incident reporting', ad: 'Advertorial', election: 'Election coverage', other: 'Other',
}
export const sevLabel = (sev: string, lang: CmsLang) => (lang === 'en' ? SEV_LABEL_EN : SEV_LABEL)[sev] ?? sev
export const riskLabel = (risk: LegalCheck['risk'], lang: CmsLang) => (lang === 'en' ? RISK_LABEL_EN : RISK_LABEL)[risk]
export const legalTypeLabel = (type: LegalIssue['type'], lang: CmsLang) => (lang === 'en' ? LEGAL_TYPE_LABEL_EN : LEGAL_TYPE_LABEL)[type] ?? type
export const RISK_TONE: Record<string, string> = { high: 'bg-danger text-white', medium: 'bg-draft text-[#3B2A00]', low: 'bg-published text-white' }

// AI 법적 검수 결과 (기사쓰기 확인창과 편집장 승인 화면이 같이 쓴다)
export default function LegalReview({ check, compact = false }: { check: LegalCheck; compact?: boolean }) {
  const t = useT()
  const lang = useCmsLang()
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-[12px] font-bold ${RISK_TONE[check.risk]}`}>{t('법적 위험', 'Legal risk')} {riskLabel(check.risk, lang)}</span>
        <p className="min-w-[12rem] flex-1 text-[13.5px]">{check.summary || (check.issues.length ? '' : t('문제가 될 만한 표현을 찾지 못했습니다.', 'No potentially problematic expressions were found.'))}</p>
        {check.checked_at && !compact && <span className="text-[11.5px] tabular-nums text-muted">{lang === 'en' ? `Reviewed ${formatDateTime(check.checked_at, lang)}` : `${formatDateTime(check.checked_at)} 검수`}</span>}
      </div>
      {check.reused && <p className="text-[12px] text-muted">{t('앞서 검수한 뒤로 제목·본문이 바뀌지 않아 그때 결과를 그대로 보여 드립니다', 'The headline and body have not changed since the earlier review, so that result is shown as is')}{check.checked_at ? ` (${formatDateTime(check.checked_at, lang)})` : ''}.</p>}
      {check.issues.length > 0 && (
        <ol className="space-y-2">
          {check.issues.map((x, i) => (
            <li key={i} className={`rounded-lg border px-4 py-3 text-[13px] leading-relaxed ${SEV[x.severity] ?? SEV.low}`}>
              <p className="flex flex-wrap items-center gap-2 text-[12px] font-bold">
                <span>{legalTypeLabel(x.type, lang)}</span>
                <span className="font-semibold text-muted">· {sevLabel(x.severity, lang)}</span>
                {x.decision && <span className={`ml-auto rounded px-1.5 py-0.5 text-[11px] ${x.decision === 'fixed' ? 'bg-published/15 text-published' : 'bg-ink/5 text-muted'}`}>{x.decision === 'fixed' ? t('AI 문장으로 고침', 'Fixed with AI wording') : t('그대로 둠', 'Kept as is')}</span>}
              </p>
              {x.quote && <blockquote className="mt-1.5 border-l-2 border-ink/30 pl-3 text-ink">“{x.quote}”</blockquote>}
              <p className="mt-1.5"><strong className="font-semibold">{t('이유', 'Reason')}</strong> {x.reason}</p>
              {x.suggestion && <p className="mt-0.5"><strong className="font-semibold">{t('고치는 방법', 'How to fix')}</strong> {x.suggestion}</p>}
              {x.fix && x.decision === 'fixed' && <p className="mt-0.5"><strong className="font-semibold">{t('바꾼 문장', 'Revised wording')}</strong> “{x.fix}”</p>}
            </li>
          ))}
        </ol>
      )}
      <p className="text-[11.5px] leading-relaxed text-muted">{t('AI 검수는 참고용이며 법률 자문이 아닙니다. 인터넷에서 다른 기사와 똑같은지까지 대조하지는 않으니, 다른 매체 글을 옮겼다면 출처를 꼭 밝혀 주세요.', 'The AI review is for reference only and is not legal advice. It does not check whether the text matches other articles online, so if you reproduced text from another outlet, be sure to credit the source.')}</p>
    </div>
  )
}
