import type { InvoiceItem } from './support'

// 1년 결제 청구서의 "할인 내역 일일이 보여 주기": 정가 12개월분 한 줄 + 할인마다 한 줄(마이너스)
//   정가 = 월 이용료 × 12 (이용 시작 월부터 12개월, 마지막 달은 시작 월 + 11개월)
//   개통일 일할: 시작 월 1일~개통 전날은 이용하지 않으므로 그만큼 뺀다
//   1년 결제 혜택: 이용료 1개월분 무료 (월 이용료만큼 뺀다)
//   반값 기간: 베타 반값(처음 3개월)과 특별 추가 개월을 시작 월부터 이어서, 그 달 이용료(첫 달은 일할분)의 반값(또는 입력한 %)만큼 뺀다
export type AnnualOpts = {
  monthly: number          // 월 이용료(정가)
  planLabel: string        // 예: "베이직 요금제"
  start: string            // 이용 시작일 YYYY-MM-DD
  freeMonth: boolean       // 1년 결제 1개월 무료
  betaMonths: number       // 베타 반값 개월 수 (처음 N개월, 보통 3 또는 0)
  extraHalfMonths: number  // 특별 추가 반값 개월 수
  rate: number             // 할인율 0~1 (반값 = 0.5)
}

const round10 = (n: number) => Math.round(n / 10) * 10
const ym = (y: number, m0: number) => ({ y: y + Math.floor(m0 / 12), m: (m0 % 12 + 12) % 12 + 1 })
const label = (y: number, m: number) => `${y}년 ${m}월`

export function annualItemized(o: AnnualOpts): { items: InvoiceItem[]; memo: string; list: number; total: number; discount: number } | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(o.start) || !(o.monthly > 0)) return null
  const y0 = Number(o.start.slice(0, 4)); const m0 = Number(o.start.slice(5, 7)); const d0 = Number(o.start.slice(8, 10))
  const dim = new Date(y0, m0, 0).getDate()
  if (d0 < 1 || d0 > dim) return null
  const used = dim - d0 + 1
  const f0 = used / dim
  const M = o.monthly
  const end = ym(y0, m0 - 1 + 11)
  const endDay = new Date(end.y, end.m, 0).getDate()
  const pct = Math.round(o.rate * 100)
  const half = pct === 50 ? '반값' : `${pct}%`
  const items: InvoiceItem[] = []
  const list = M * 12
  items.push({ name: `IM 뉴스룸 ${o.planLabel} 1년 정가 (월 ${M.toLocaleString('ko-KR')}원 × 12개월, ${label(y0, m0)}~${label(end.y, end.m)})`, qty: 1, unit_price: list })
  const n = Math.max(0, o.betaMonths) + Math.max(0, o.extraHalfMonths)
  // 첫 달이 반값(할인) 기간이면, 개통 전 미이용분도 반값 기준으로 뺀다: 정가 한 달 − 그 달 반값 − 미이용분(반값 적용) = 이용한 날짜분의 반값
  const firstDiscounted = n > 0
  if (d0 > 1) {
    const unused = round10(M * (1 - f0) * (firstDiscounted ? 1 - o.rate : 1))
    const basis = firstDiscounted ? ` × ${100 - pct}%` : ''
    items.push({ name: `개통 전 미이용분 조정 (${m0}월 1일~${d0 - 1}일, ${d0 - 1}일/${dim}일분${basis})`, qty: 1, unit_price: -unused })
  }
  if (o.freeMonth) items.push({ name: '1년 결제 혜택 · 1개월 무료 (월 이용료 1개월분)', qty: 1, unit_price: -M })
  for (let j = 0; j < n; j++) {
    const { y, m } = ym(y0, m0 - 1 + j)
    const amount = round10(M * o.rate)
    if (amount <= 0) continue
    const kind = j < o.betaMonths ? `베타 ${half} 할인` : `추가 ${half} 할인 (특별 조건)`
    items.push({ name: `${kind} · ${label(y, m)}`, qty: 1, unit_price: -amount })
  }
  const total = items.reduce((s, i) => s + i.qty * i.unit_price, 0)
  const discount = list - total
  const startLabel = `${y0}.${String(m0).padStart(2, '0')}.${String(d0).padStart(2, '0')}`
  const endLabel = `${end.y}.${String(end.m).padStart(2, '0')}.${String(endDay).padStart(2, '0')}`
  const memo = `이용 기간은 ${startLabel}부터 ${endLabel}까지입니다. 정가 ${list.toLocaleString('ko-KR')}원에서 아래 할인 ${discount.toLocaleString('ko-KR')}원을 빼고 ${total.toLocaleString('ko-KR')}원을 청구합니다. 할인은 항목마다 따로 적었습니다.`
  return { items, memo, list, total, discount }
}

// 서버가 채운 항목 중 요금제 이용료 줄과 베타 반값 줄은 위 계산이 대신하므로 뺀다
export const isPlanOrBetaLine = (name: string) => (name.includes('요금제') && !name.startsWith('세팅비')) || name.startsWith('베타 반값')
