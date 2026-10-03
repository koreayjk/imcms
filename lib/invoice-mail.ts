import type { SupabaseClient } from '@supabase/supabase-js'
import { notify } from './notify'
import { formatDate } from './format'

// 청구서 발행 안내 메일 (결제 담당자, 없으면 발행인). 자동결제를 등록한 매체는 결제 예정일도 알린다 (결제 7일 전 고지)
//   직접 발행(고객센터)과 매월 자동 발행이 같이 쓴다
export async function notifyInvoiceIssued(supabase: SupabaseClient, inv: {
  id: string
  outletName: string
  month: string
  total: number
  dueDate: string | null
  createdAt: string
  autopay: { card_company: string | null; card_number: string | null } | null
  origin: string
}) {
  const monthText = `${Number(inv.month.slice(0, 4))}년 ${Number(inv.month.slice(5, 7))}월`
  // 자동결제는 발행 7일 뒤부터 납부 기한 오전 10시에
  const earliest = Date.parse(inv.createdAt) + 7 * 864e5
  const due = inv.dueDate ? Date.parse(`${inv.dueDate}T10:00:00+09:00`) : earliest
  const chargeAt = new Date(Math.max(due, earliest)).toISOString()
  const won = Number(inv.total).toLocaleString('ko-KR')
  await notify(supabase, 'invoice_issued', inv.id, `invoice:${inv.id}`, () => ({
    subject: `[IM 뉴스룸] ${inv.outletName} ${monthText} 청구서 (${won}원)`,
    title: `${monthText} 청구서가 발행되었습니다`,
    lines: [
      `${inv.outletName} · 청구 금액 ${won}원 (부가세 포함)${inv.dueDate ? ` · 납부 기한 ${formatDate(inv.dueDate)}` : ''}`,
      inv.autopay
        ? `등록하신 결제수단(${inv.autopay.card_company ?? ''} ${inv.autopay.card_number ?? ''})으로 ${formatDate(chargeAt)}에 자동 결제됩니다. 바꾸거나 해지하려면 편집국 고객센터 → 결제 정보에서 할 수 있습니다.`
        : '편집국 고객센터 → 청구서에서 카드·간편결제로 바로 결제할 수 있습니다.',
    ],
    button: { label: '청구서 보기', url: `${inv.origin}/support/invoices/${inv.id}` },
    footer: '이 메일은 IM 뉴스룸 이용료 청구 안내입니다.',
  }))
}
