// 고객센터 공통: 요청 유형·상태·공지 분류 이름과 금액 표시

export const TICKET_CATEGORIES = {
  content: '기사·편집',
  design: '디자인',
  dev: '기능·개발',
  error: '오류·장애',
  billing: '계약·요금',
  etc: '기타 문의',
} as const
export type TicketCategory = keyof typeof TICKET_CATEGORIES

export const TICKET_STATUS = {
  received: { label: '접수', className: 'bg-danger/10 text-danger' },
  in_progress: { label: '진행', className: 'bg-review/10 text-review' },
  done: { label: '완료', className: 'bg-line text-muted' },
} as const
export type TicketStatus = keyof typeof TICKET_STATUS

export const NOTICE_CATEGORIES = {
  notice: { label: '공지', className: 'bg-ink text-white' },
  update: { label: '업데이트', className: 'bg-published/10 text-published' },
  maintenance: { label: '점검', className: 'bg-draft/15 text-[#6B5F22]' },
  security: { label: '보안', className: 'bg-danger/10 text-danger' },
} as const
export type NoticeCategory = keyof typeof NOTICE_CATEGORIES

export const STAFF_NAME = 'IM 뉴스룸 운영팀'

export function won(n: number | null | undefined) {
  return `${Math.round(n ?? 0).toLocaleString('ko-KR')}원`
}

export type InvoiceItem = { name: string; qty: number; unit_price: number }

// 단가는 부가세 포함 금액이다 (요금표와 같은 기준). 합계에서 공급가액·부가세를 거꾸로 나눈다
export function invoiceTotals(items: InvoiceItem[]) {
  const total = items.reduce((s, i) => s + Math.round((i.qty || 0) * (i.unit_price || 0)), 0)
  const supply = Math.round(total / 1.1)
  return { supply, vat: total - supply, total }
}

export function monthLabel(d: string) {
  const [y, m] = d.split('-')
  return `${y}년 ${Number(m)}월`
}

// 새 답변이 있는지 (요청자 기준)
export function hasUnreadReply(t: { last_staff_reply_at: string | null; requester_read_at: string | null }) {
  return !!t.last_staff_reply_at && (!t.requester_read_at || t.last_staff_reply_at > t.requester_read_at)
}
