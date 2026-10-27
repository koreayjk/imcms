// 고객센터·청구 화면의 영어 이름과 금액·월 표시 (lib/support.ts 의 한국어 상수는 그대로 두고 영어를 따로 둔다)
//   한국어 화면은 기존 상수 그대로, 영어일 때만 이 파일의 값을 쓴다
import { monthLabel as monthLabelKo, STAFF_NAME, TAX_NOTE, TICKET_CATEGORIES, TICKET_STATUS, NOTICE_CATEGORIES, won as wonKo, type NoticeCategory, type TicketCategory, type TicketStatus } from './support'

type L = 'ko' | 'en' | undefined

export const TICKET_CATEGORIES_EN: Record<TicketCategory, string> = {
  content: 'Stories & editing',
  design: 'Design',
  dev: 'Features & development',
  error: 'Errors & outages',
  billing: 'Contract & billing',
  etc: 'Other inquiry',
}
export const TICKET_STATUS_EN: Record<TicketStatus, string> = { received: 'Received', in_progress: 'In progress', done: 'Done' }
export const NOTICE_CATEGORIES_EN: Record<NoticeCategory, string> = { notice: 'Notice', update: 'Update', maintenance: 'Maintenance', security: 'Security' }
export const STAFF_NAME_EN = 'IM Newsroom team'
export const TAX_NOTE_EN = 'Supplied by IM America Group Corp (U.S.) · no Korean VAT'

export const ticketCategoryLabel = (c: string, lang?: L) => (lang === 'en' ? TICKET_CATEGORIES_EN : TICKET_CATEGORIES)[c as TicketCategory] ?? c
export const ticketStatusLabel = (s: string, lang?: L) => (lang === 'en' ? TICKET_STATUS_EN[s as TicketStatus] : TICKET_STATUS[s as TicketStatus]?.label) ?? s
export const noticeCategoryLabel = (c: string, lang?: L) => (lang === 'en' ? NOTICE_CATEGORIES_EN[c as NoticeCategory] : NOTICE_CATEGORIES[c as NoticeCategory]?.label) ?? c
export const staffName = (lang?: L) => (lang === 'en' ? STAFF_NAME_EN : STAFF_NAME)
export const taxNote = (lang?: L) => (lang === 'en' ? TAX_NOTE_EN : TAX_NOTE)

// 금액: 한국어 "110,000원" / 영어 "KRW 110,000"
export const wonL = (n: number | null | undefined, lang?: L) =>
  lang === 'en' ? `KRW ${Math.round(n ?? 0).toLocaleString('en-US')}` : wonKo(n)
// 'YYYY-MM-DD' → 한국어 "2026년 10월" / 영어 "October 2026"
const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const monthLabelL = (d: string, lang?: L) => {
  if (lang !== 'en') return monthLabelKo(d)
  const [y, m] = d.split('-')
  return `${MONTHS_EN[Number(m) - 1] ?? m} ${y}`
}
