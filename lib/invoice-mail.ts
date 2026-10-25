import type { SupabaseClient } from '@supabase/supabase-js'
import { notify } from './notify'
import { formatDate } from './format'
import { GRACE_DAYS } from './billing'
import { payLinkFor } from './pay-link'
import { esc } from './mail'
import { ISSUER, PRODUCT } from './product'

// 청구서 발행 안내 메일 (결제 담당자, 없으면 발행인). 자동결제를 등록한 매체는 결제 예정일도 알린다 (결제 7일 전 고지)
//   직접 발행(고객센터)과 매월 자동 발행이 같이 쓴다
type IssuedInv = {
  id: string
  outletName: string
  month: string
  total: number
  dueDate: string | null
  createdAt: string
  autopay: { card_company: string | null; card_number: string | null } | null
  origin: string
  payUrl?: string | null // 로그인 없이 결제하는 전용 링크 (supabase/invoice-pay-link.sql)
  items?: { name: string; qty: number; unit_price: number }[] // 메일 본문에 그대로 보여 줄 청구 항목
  memo?: string | null // 청구서 안내(무료 기간 안내 등)
  invoiceNo?: string | null
}

const e = esc
const wonText = (n: number) => `${Number(n).toLocaleString('ko-KR')}원`

// 청구서 발행 안내 메일: 청구서 서식(공급자·청구 대상·항목표·합계·안내)을 메일 본문에 그대로 보여 주고, "결제하기" 버튼은 로그인 없이 바로 Stripe 결제창으로 간다
//   실제 발송과 "나에게 보내기" 미리보기가 같이 쓴다 (preview 가 있으면 맨 위에 미리보기 안내와 받을 사람을 적는다)
export function invoiceDocMail(inv: IssuedInv, preview?: { note: string }) {
  const monthText = `${Number(inv.month.slice(0, 4))}년 ${Number(inv.month.slice(5, 7))}월`
  // 자동결제는 발행 다음 날부터, 납부 기한 오전 10시에 (매월 정기 청구는 말일에 발행해 1일 오전 10시에 결제)
  const earliest = Date.parse(inv.createdAt) + 864e5
  const due = inv.dueDate ? Date.parse(`${inv.dueDate}T10:00:00+09:00`) : earliest
  const chargeDay = formatDate(new Date(Math.max(due, earliest)).toISOString())
  const won = wonText(inv.total)
  const items = inv.items ?? []
  const card = inv.autopay ? `${inv.autopay.card_company ?? ''} ${inv.autopay.card_number ?? ''}`.trim() : ''
  const payBtn = inv.payUrl ?? `${inv.origin}/support/invoices/${inv.id}`
  const subject = inv.autopay
    ? `[IM 뉴스룸] ${inv.outletName} ${chargeDay} ${won} 자동 결제 예정 (${monthText} 청구서)`
    : `[IM 뉴스룸] ${inv.outletName} ${monthText} 청구서 (${won})`
  const notes = (inv.memo ?? '').split('\n').map((l) => l.trim()).filter(Boolean)

  const rowHtml = items.map((i) => {
    const amount = i.qty * i.unit_price
    const [main, ...rest] = i.name.split(' — ')
    return `<tr><td style="padding:12px 0;border-bottom:1px solid #E5E8EC;font-size:14px;line-height:1.55;color:#14171C">${e(main)}${rest.length ? `<div style="margin-top:2px;font-size:12.5px;color:#6B7280">${e(rest.join(' — '))}</div>` : ''}</td>
<td align="center" style="padding:12px 8px;border-bottom:1px solid #E5E8EC;font-size:14px;color:#3B4048;white-space:nowrap">${i.qty}</td>
<td align="right" style="padding:12px 0;border-bottom:1px solid #E5E8EC;font-size:14px;white-space:nowrap;${amount === 0 ? 'color:#0E7A3E;font-weight:700' : amount < 0 ? 'color:#C2410C;font-weight:700' : 'color:#14171C'}">${amount === 0 ? '무료' : amount < 0 ? `-${e(wonText(-amount))}` : e(wonText(amount))}</td></tr>`
  }).join('')

  const html = `<!doctype html><html lang="ko"><body style="margin:0;background:#F4F5F7;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#14171C">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:12px;padding:32px 28px">
${preview ? `<tr><td style="padding-bottom:16px"><div style="background:#FFF7E6;border-radius:8px;padding:10px 14px;font-size:13px;line-height:1.6;color:#7A4B00"><strong>미리보기</strong> — 아직 발행되지 않았고 고객에게는 가지 않았습니다.<br>${e(preview.note)}</div></td></tr>` : ''}
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="font-size:14px;font-weight:800;color:#1D3461"><img src="https://app.imnewsroom.com/brand/icon-192.png" width="32" height="32" alt="" style="vertical-align:middle;border-radius:7px;margin-right:8px;border:0">IM 뉴스룸</td>
<td align="right" style="font-size:12px;letter-spacing:.14em;color:#8A9099;font-weight:700">청구서 · INVOICE</td></tr></table></td></tr>
<tr><td style="padding-top:22px;font-size:22px;font-weight:800;line-height:1.35">${e(monthText)} 이용료 청구서</td></tr>
<tr><td style="padding-top:4px;font-size:15px;color:#3B4048">${e(inv.outletName)}</td></tr>
<tr><td style="padding-top:16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;color:#3B4048;line-height:1.9">
${inv.invoiceNo ? `<tr><td style="color:#8A9099;width:96px">청구서 번호</td><td>${e(inv.invoiceNo)}</td></tr>` : ''}
<tr><td style="color:#8A9099;width:96px">발행일</td><td>${e(formatDate(inv.createdAt))}</td></tr>
${inv.dueDate ? `<tr><td style="color:#8A9099">${inv.autopay ? '결제 예정일' : '납부 기한'}</td><td><strong>${e(formatDate(`${inv.dueDate}T00:00:00+09:00`))}</strong></td></tr>` : ''}
<tr><td style="color:#8A9099;vertical-align:top">공급자</td><td>${e(ISSUER.company ?? PRODUCT.name)}${ISSUER.bizNo ? ` · ${e(ISSUER.bizNoLabel)} ${e(ISSUER.bizNo)}` : ''}</td></tr>
<tr><td style="color:#8A9099">청구 대상</td><td>${e(inv.outletName)}</td></tr>
</table></td></tr>
${inv.autopay ? `<tr><td style="padding-top:18px"><div style="background:#EEF3FF;border-radius:8px;padding:12px 14px;font-size:14px;line-height:1.65;color:#1F3A5F"><strong>${e(chargeDay)} 오전 10시에 ${e(card)} 카드로 ${e(won)}이 자동 결제됩니다.</strong><br>따로 하실 일은 없습니다. 카드를 바꾸거나 해지하려면 편집국 고객센터 → 결제 정보에서 할 수 있습니다.</div></td></tr>` : ''}
<tr><td style="padding-top:22px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:2px solid #14171C">
<tr><td style="padding:9px 0;font-size:12.5px;color:#8A9099">항목</td><td align="center" style="padding:9px 8px;font-size:12.5px;color:#8A9099">수량</td><td align="right" style="padding:9px 0;font-size:12.5px;color:#8A9099">금액</td></tr>
${rowHtml}
<tr><td colspan="2" style="padding:16px 0 4px;font-size:15px;font-weight:800">합계 <span style="font-size:11.5px;font-weight:400;color:#8A9099">(해외 법인 공급, 한국 부가세 없음)</span></td><td align="right" style="padding:16px 0 4px;font-size:20px;font-weight:800;white-space:nowrap">${e(won)}</td></tr>
</table></td></tr>
${notes.length ? `<tr><td style="padding-top:18px"><div style="background:#ECF8F1;border-radius:8px;padding:12px 14px;font-size:14px;line-height:1.7;color:#14532D">${notes.map((l) => e(l)).join('<br>')}</div></td></tr>` : ''}
<tr><td style="padding-top:26px"><a href="${e(payBtn)}" style="display:block;background:#2F6BF0;color:#fff;text-decoration:none;font-weight:800;font-size:17px;text-align:center;padding:16px 20px;border-radius:10px">${inv.autopay ? '청구서 보기' : `결제하기 · ${e(won)}`}</a></td></tr>
${inv.autopay ? '' : `<tr><td style="padding-top:10px;font-size:12px;line-height:1.7;color:#6B7280;text-align:center">버튼을 누르면 로그인 없이 Stripe 결제창이 바로 열립니다(국내 카드·카카오페이·네이버페이 등).<br>처음 결제하면 이 카드가 다음 달부터 자동결제 카드로 저장되며, 결제 화면에서 안내를 확인할 수 있습니다.<br>※ 결제창의 <strong>"카드"</strong> 항목은 카드사에 따라 해외결제 수수료(약 1~3%)가 카드사에서 따로 붙을 수 있습니다(체크카드에서 흔합니다). 청구 금액 그대로 결제하려면 <strong>"국내 카드"</strong>를 선택하세요.</td></tr>`}
<tr><td style="padding-top:26px;font-size:12px;line-height:1.6;color:#8A9099">이 메일은 IM 뉴스룸 이용료 청구 안내입니다. 문의 ${e(ISSUER.contact ?? '고객센터')}${preview ? '' : ''}</td></tr>
</table></td></tr></table></body></html>`

  const text = [
    `${monthText} 이용료 청구서 · ${inv.outletName}`,
    inv.invoiceNo ? `청구서 번호: ${inv.invoiceNo}` : '',
    inv.dueDate ? `${inv.autopay ? '결제 예정일' : '납부 기한'}: ${formatDate(`${inv.dueDate}T00:00:00+09:00`)}` : '',
    '',
    ...items.map((i) => `· ${i.name} × ${i.qty}: ${i.qty * i.unit_price === 0 ? '무료' : i.qty * i.unit_price < 0 ? `-${wonText(-(i.qty * i.unit_price))}` : wonText(i.qty * i.unit_price)}`),
    `합계: ${won} (한국 부가세 없음)`,
    ...(notes.length ? ['', ...notes] : []),
    '',
    inv.autopay ? `${chargeDay} 오전 10시에 ${card} 카드로 자동 결제됩니다.` : `결제하기: ${payBtn}`,
    '',
    '이 메일은 IM 뉴스룸 이용료 청구 안내입니다.',
  ].filter((l, idx, arr) => l !== '' || arr[idx - 1] !== '').join('\n')
  return { subject, html, text }
}

export async function notifyInvoiceIssued(supabase: SupabaseClient, inv: IssuedInv) {
  // 메일의 결제하기 버튼: 로그인 없이 바로 Stripe 결제창으로 가는 주소 (/pay/토큰/go)
  const base = inv.payUrl ?? (await payLinkFor(supabase, inv.id, inv.origin))
  const payUrl = base ? `${base}/go` : null
  await notify(supabase, 'invoice_issued', inv.id, `invoice:${inv.id}`, () => invoiceDocMail({ ...inv, payUrl }))
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
  const payUrl = await payLinkFor(supabase, inv.id, inv.origin)
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
    button: { label: '결제하기', url: payUrl ? `${payUrl}/go` : `${inv.origin}/support/invoices/${inv.id}` },
    footer: '이 메일은 IM 뉴스룸 이용료 안내입니다.',
  }))
}
