// 개선 요청 (feedback.sql): 분류·상태 이름

export const FEEDBACK_CATEGORIES = {
  improve: '개선',
  bug: '불편·오류',
  new: '새 기능',
  etc: '기타',
} as const
export type FeedbackCategory = keyof typeof FEEDBACK_CATEGORIES

export const FEEDBACK_STATUS = {
  received: { label: '접수', className: 'bg-danger/10 text-danger' },
  in_progress: { label: '처리중', className: 'bg-review/10 text-review' },
  exists: { label: '이미 있음', className: 'bg-draft/15 text-[#6B5F22]' },
  done: { label: '처리완료', className: 'bg-published/10 text-published' },
  declined: { label: '반영 어려움', className: 'bg-line text-muted' },
} as const
export type FeedbackStatus = keyof typeof FEEDBACK_STATUS

// 영어 화면용 이름 (색 className 은 한국어 쪽을 그대로 쓴다)
export const FEEDBACK_CATEGORIES_EN: Record<FeedbackCategory, string> = {
  improve: 'Improvement',
  bug: 'Problem / bug',
  new: 'New feature',
  etc: 'Other',
}
export const FEEDBACK_STATUS_EN: Record<FeedbackStatus, string> = {
  received: 'Received',
  in_progress: 'In progress',
  exists: 'Already available',
  done: 'Done',
  declined: 'Not planned',
}
type L = 'ko' | 'en' | undefined
export const feedbackCategoryLabel = (c: string, lang?: L, fallback = '') =>
  (lang === 'en' ? FEEDBACK_CATEGORIES_EN : FEEDBACK_CATEGORIES)[c as FeedbackCategory] ?? fallback
export const feedbackStatusLabel = (s: string, lang?: L) =>
  (lang === 'en' ? FEEDBACK_STATUS_EN[s as FeedbackStatus] : FEEDBACK_STATUS[s as FeedbackStatus]?.label) ?? s

export const isFeedbackStatus = (s: unknown): s is FeedbackStatus => typeof s === 'string' && s in FEEDBACK_STATUS
export const isFeedbackCategory = (s: unknown): s is FeedbackCategory => typeof s === 'string' && s in FEEDBACK_CATEGORIES

// 표가 아직 없을 때 (feedback.sql 실행 전)
export const feedbackMissing = (msg?: string | null) => /feedback_(posts|comments)/.test(msg ?? '') && /does not exist|schema cache|not find/i.test(msg ?? '')
