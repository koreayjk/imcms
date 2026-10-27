// 고객센터 공통: 요청 유형·상태·공지 분류 이름과 금액 표시
//   영어 화면: 아래 *_EN 이름표나 도우미(ticketStatusLabel 등)를 쓴다. 한국어 상수는 그대로 둔다
import type { CmsLang } from './cms-i18n'

export const TICKET_CATEGORIES = {
  content: '기사·편집',
  design: '디자인',
  dev: '기능·개발',
  error: '오류·장애',
  billing: '계약·요금',
  etc: '기타 문의',
} as const
export type TicketCategory = keyof typeof TICKET_CATEGORIES
export const TICKET_CATEGORIES_EN: Record<TicketCategory, string> = {
  content: 'Stories & editing',
  design: 'Design',
  dev: 'Features & development',
  error: 'Errors & outages',
  billing: 'Contract & billing',
  etc: 'Other inquiries',
}
export const ticketCategoryLabel = (c: TicketCategory, lang: CmsLang = 'ko') => (lang === 'en' ? TICKET_CATEGORIES_EN : TICKET_CATEGORIES)[c]

export const TICKET_STATUS = {
  received: { label: '접수', className: 'bg-danger/10 text-danger' },
  in_progress: { label: '진행', className: 'bg-review/10 text-review' },
  done: { label: '완료', className: 'bg-line text-muted' },
} as const
export type TicketStatus = keyof typeof TICKET_STATUS
export const TICKET_STATUS_LABEL_EN: Record<TicketStatus, string> = { received: 'Received', in_progress: 'In progress', done: 'Done' }
export const ticketStatusLabel = (s: TicketStatus, lang: CmsLang = 'ko') => (lang === 'en' ? TICKET_STATUS_LABEL_EN[s] : TICKET_STATUS[s].label)

export const NOTICE_CATEGORIES = {
  notice: { label: '공지', className: 'bg-ink text-white' },
  update: { label: '업데이트', className: 'bg-published/10 text-published' },
  maintenance: { label: '점검', className: 'bg-draft/15 text-[#6B5F22]' },
  security: { label: '보안', className: 'bg-danger/10 text-danger' },
} as const
export type NoticeCategory = keyof typeof NOTICE_CATEGORIES
export const NOTICE_CATEGORY_LABEL_EN: Record<NoticeCategory, string> = { notice: 'Notice', update: 'Update', maintenance: 'Maintenance', security: 'Security' }
export const noticeCategoryLabel = (c: NoticeCategory, lang: CmsLang = 'ko') => (lang === 'en' ? NOTICE_CATEGORY_LABEL_EN[c] : NOTICE_CATEGORIES[c].label)

export const STAFF_NAME = 'IM 뉴스룸 운영팀'
export const STAFF_NAME_EN = 'IM Newsroom team'
export const staffName = (lang: CmsLang = 'ko') => (lang === 'en' ? STAFF_NAME_EN : STAFF_NAME)

export function won(n: number | null | undefined, lang: CmsLang = 'ko') {
  if (lang === 'en') return `KRW ${Math.round(n ?? 0).toLocaleString('en-US')}`
  return `${Math.round(n ?? 0).toLocaleString('ko-KR')}원`
}

export type InvoiceItem = { name: string; qty: number; unit_price: number }

// 미국 법인(IM America Group Corp)이 공급하는 해외 서비스라 한국 부가세를 따로 받지 않는다: 합계 = 공급가액, 부가세 0
//   (DB 칸 supply_amount·vat 는 그대로 두고 값만 이렇게 채운다)
export const TAX_NOTE = '해외 법인(미국 IM America Group Corp) 공급 · 한국 부가세 없음'
export const TAX_NOTE_EN = 'Supplied by a foreign entity (IM America Group Corp, USA) · No Korean VAT'
export const taxNote = (lang: CmsLang = 'ko') => (lang === 'en' ? TAX_NOTE_EN : TAX_NOTE)
export function invoiceTotals(items: InvoiceItem[]) {
  const total = items.reduce((s, i) => s + Math.round((i.qty || 0) * (i.unit_price || 0)), 0)
  return { supply: total, vat: 0, total }
}

export function monthLabel(d: string, lang: CmsLang = 'ko') {
  const [y, m] = d.split('-')
  if (lang === 'en') return `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][Number(m) - 1] ?? m} ${y}`
  return `${y}년 ${Number(m)}월`
}

// 새 답변이 있는지 (요청자 기준)
export function hasUnreadReply(t: { last_staff_reply_at: string | null; requester_read_at: string | null }) {
  return !!t.last_staff_reply_at && (!t.requester_read_at || t.last_staff_reply_at > t.requester_read_at)
}
