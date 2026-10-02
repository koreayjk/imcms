// AI 법적 검수 결과의 모양과 표시 이름 (화면에서도 쓰므로 서버 코드와 나눠 둔다)
export type LegalIssue = {
  type: 'defamation' | 'insult' | 'privacy' | 'copyright' | 'false_info' | 'crime_report' | 'ad' | 'election' | 'other'
  severity: 'low' | 'medium' | 'high'
  quote: string
  // quote 자리에 바꿔 넣을 문장 (문장으로 해결되지 않으면 빈 값)
  fix?: string
  reason: string
  suggestion: string
  // 기자·편집장이 고른 것: fixed = AI 문장으로 바꿈, kept = 그대로 둠
  decision?: 'fixed' | 'kept'
}
// content_hash: 검수한 제목·부제·본문 글자의 해시. 같으면 다시 검수하지 않고 저장된 결과를 쓴다 (reused = 그렇게 다시 쓴 결과)
export type LegalCheck = { risk: 'low' | 'medium' | 'high'; summary: string; issues: LegalIssue[]; model?: string; checked_at?: string; content_hash?: string; reused?: boolean }

export const LEGAL_TYPE_LABEL: Record<LegalIssue['type'], string> = {
  defamation: '명예훼손', insult: '모욕·비하', privacy: '개인정보·초상권', copyright: '저작권·도용',
  false_info: '사실 확인 필요', crime_report: '범죄·사건 보도', ad: '기사형 광고', election: '선거 보도', other: '기타',
}
export const RISK_LABEL: Record<LegalCheck['risk'], string> = { low: '낮음', medium: '주의', high: '높음' }

