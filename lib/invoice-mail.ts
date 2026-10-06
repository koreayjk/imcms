import type { SupabaseClient } from '@supabase/supabase-js'
import { notify } from './notify'
import { formatDate } from './format'
import { GRACE_DAYS } from './billing'

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
      `${inv.outletName} · 청구 금액 ${won}원${inv.dueDate ? ` · 납부 기한 ${formatDate(inv.dueDate)}` : ''}`,
      inv.autopay
        ? `등록하신 결제수단(${inv.autopay.card_company ?? ''} ${inv.autopay.card_number ?? ''})으로 ${formatDate(chargeAt)}에 자동 결제됩니다. 바꾸거나 해지하려면 편집국 고객센터 → 결제 정보에서 할 수 있습니다.`
        : '편집국 고객센터 → 청구서에서 카드·간편결제로 바로 결제할 수 있습니다.',
    ],
    button: { label: '청구서 보기', url: `${inv.origin}/support/invoices/${inv.id}` },
    footer: '이 메일은 IM 뉴스룸 이용료 청구 안내입니다.',
  }))
}

// 미납 안내(납부 기한 다음 날, 유예 중)와 이용 제한 안내(유예가 지난 날). 같은 청구서·같은 단계는 한 번만
export async function notifyInvoiceDunning(supabase: SupabaseClient, inv: {
  id: string
  outletName: string
  month: string
  total: number
  dueDate: string
  stage: 'overdue' | 'hold'
  origin: string
}) {
  const monthText = `${Number(inv.month.slice(0, 4))}년 ${Number(inv.month.slice(5, 7))}월`
  const won = Number(inv.total).toLocaleString('ko-KR')
  const lastDay = new Date(Date.parse(`${inv.dueDate}T00:00:00Z`) + GRACE_DAYS * 864e5).toISOString().slice(0, 10)
  const hold = inv.stage === 'hold'
  await notify(supabase, hold ? 'invoice_hold' : 'invoice_overdue', inv.id, `${inv.stage}:${inv.id}`, () => ({
    subject: hold
      ? `[IM 뉴스룸] ${inv.outletName} 편집국 이용이 제한되었습니다 (${monthText} 미납)`
      : `[IM 뉴스룸] ${inv.outletName} ${monthText} 이용료 미납 안내 (${won}원)`,
    title: hold ? '이용료가 밀려 편집국 이용이 제한되었습니다' : `${monthText} 이용료의 납부 기한이 지났습니다`,
    lines: hold
      ? [
          `${inv.outletName} · ${monthText} 청구 금액 ${won}원 (납부 기한 ${formatDate(inv.dueDate)})`,
          '지금은 기사 쓰기·고치기·발행과 AI 기능을 쓸 수 없습니다. 신문 홈페이지는 그대로 열려 있습니다.',
          '편집국 고객센터 → 청구서에서 결제하면 바로 다시 쓸 수 있습니다.',
        ]
      : [
          `${inv.outletName} · ${monthText} 청구 금액 ${won}원 · 납부 기한 ${formatDate(inv.dueDate)}`,
          `${formatDate(lastDay)}까지 결제하지 않으면 다음 날부터 편집국 이용(기사 쓰기·발행)이 제한됩니다.`,
          '편집국 고객센터 → 청구서에서 카드·간편결제로 바로 결제할 수 있습니다. 이미 내셨다면 이 메일은 무시해 주세요.',
        ],
    button: { label: '청구서 보고 결제하기', url: `${inv.origin}/support/invoices/${inv.id}` },
    footer: '이 메일은 IM 뉴스룸 이용료 안내입니다.',
  }))
}
