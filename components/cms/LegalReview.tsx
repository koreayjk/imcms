import { LEGAL_TYPE_LABEL, RISK_LABEL, type LegalCheck } from '@/lib/legal-types'
import { formatDateTime } from '@/lib/format'

const SEV: Record<string, string> = {
  high: 'border-danger/40 bg-danger/5',
  medium: 'border-draft/50 bg-draft/10',
  low: 'border-line bg-paper',
}
const SEV_LABEL: Record<string, string> = { high: '위험', medium: '주의', low: '참고' }
const RISK_TONE: Record<string, string> = { high: 'bg-danger text-white', medium: 'bg-draft text-[#3B2A00]', low: 'bg-published text-white' }

// AI 법적 검수 결과 (기사쓰기 확인창과 편집장 승인 화면이 같이 쓴다)
export default function LegalReview({ check, compact = false }: { check: LegalCheck; compact?: boolean }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-2 py-0.5 text-[12px] font-bold ${RISK_TONE[check.risk]}`}>법적 위험 {RISK_LABEL[check.risk]}</span>
        <p className="min-w-0 flex-1 text-[13.5px]">{check.summary || (check.issues.length ? '' : '문제가 될 만한 표현을 찾지 못했습니다.')}</p>
        {check.checked_at && !compact && <span className="text-[11.5px] tabular-nums text-muted">{formatDateTime(check.checked_at)} 검수</span>}
      </div>
      {check.issues.length > 0 && (
        <ol className="space-y-2">
          {check.issues.map((x, i) => (
            <li key={i} className={`rounded-lg border px-4 py-3 text-[13px] leading-relaxed ${SEV[x.severity] ?? SEV.low}`}>
              <p className="flex flex-wrap items-center gap-2 text-[12px] font-bold">
                <span>{LEGAL_TYPE_LABEL[x.type] ?? x.type}</span>
                <span className="font-semibold text-muted">· {SEV_LABEL[x.severity] ?? x.severity}</span>
              </p>
              {x.quote && <blockquote className="mt-1.5 border-l-2 border-ink/30 pl-3 text-ink">“{x.quote}”</blockquote>}
              <p className="mt-1.5"><strong className="font-semibold">이유</strong> {x.reason}</p>
              {x.suggestion && <p className="mt-0.5"><strong className="font-semibold">고치는 방법</strong> {x.suggestion}</p>}
            </li>
          ))}
        </ol>
      )}
      <p className="text-[11.5px] leading-relaxed text-muted">AI 검수는 참고용이며 법률 자문이 아닙니다. 인터넷에서 다른 기사와 똑같은지까지 대조하지는 않으니, 다른 매체 글을 옮겼다면 출처를 꼭 밝혀 주세요.</p>
    </div>
  )
}
