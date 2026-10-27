// 자동결제(정기결제) 동의 문구와 버전. 카드·계좌 등록 전에 보여 주고, 동의한 사람·시각을 DB에 남긴다 (billing-safety-2.sql)
export const AUTOPAY_CONSENT_VERSION = '2026-10-24'
export const AUTOPAY_CONSENT_LINES = [
  '매월(1년 결제는 1년마다) 발행되는 IM 뉴스룸 청구서 금액을 등록한 결제수단으로 자동 결제합니다.',
  '금액은 청구서마다 다릅니다(요금제 이용료·추가 매체·AI 추가 사용 등). 청구서를 발행하면 금액과 결제 예정일을 메일로 먼저 알립니다.',
  '결제는 청구서(결제 예정 안내 메일)를 발행한 다음 날 이후, 납부 기한 오전 10시에 이루어집니다. 매월 청구서는 전달 말일에 발행해 매월 1일에 결제하고, 결제 전날까지 금액과 결제 예정일을 메일로 알립니다.',
  '고객센터 → 결제 정보에서 언제든 해지할 수 있고, 해지하면 그다음 청구서부터 자동 결제되지 않습니다.',
]
// 영어 화면용 (한국어 문구와 같은 순서·같은 뜻. 동의 버전은 한국어 원문 기준이다)
export const AUTOPAY_CONSENT_LINES_EN = [
  'Your IM Newsroom invoices, issued monthly (every year for annual billing), are charged automatically to the payment method you register.',
  'The amount differs by invoice (plan fee, additional publications, extra AI usage, etc.). When an invoice is issued, we first email you the amount and the scheduled payment date.',
  'Payment is made at 10 a.m. on the due date, on or after the day following the invoice (payment notice email). Monthly invoices are issued on the last day of the previous month and charged on the 1st, and the amount and scheduled date are emailed to you by the day before payment.',
  'You can cancel at any time under Support → Billing info; after you cancel, invoices from the next one on are not charged automatically.',
]
export const autopayConsentLines = (lang?: 'ko' | 'en') => (lang === 'en' ? AUTOPAY_CONSENT_LINES_EN : AUTOPAY_CONSENT_LINES)
