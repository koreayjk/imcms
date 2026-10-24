import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { paymentDbSecret } from './toss'

// 청구서 결제 전용 링크 (supabase/invoice-pay-link.sql): 로그인 없이 그 청구서 한 건만 보고 카드로 결제한다
//   토큰은 DB가 만들고(추측할 수 없는 긴 값), 이 파일의 함수는 서버 열쇠(PAYMENT_DB_SECRET)로만 DB 함수를 부른다

// 로그인 없는 공개 화면에서 쓰는 연결 (권한은 DB 함수의 서버 열쇠 확인이 맡는다)
export function publicDb(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
}

export const isPayToken = (t: string) => /^[0-9a-f]{40,80}$/.test(t)

// 청구서의 결제 링크 (SQL 전이거나 서버 열쇠가 없으면 null — 메일은 로그인 링크로 보낸다)
export async function payLinkFor(supabase: SupabaseClient, invoiceId: string, origin: string): Promise<string | null> {
  if (!process.env.PAYMENT_DB_SECRET) return null
  try {
    const { data, error } = await supabase.rpc('invoice_pay_token', { secret: paymentDbSecret(), inv: invoiceId })
    if (error || typeof data !== 'string' || !isPayToken(data)) return null
    return `${origin}/pay/${data}`
  } catch {
    return null
  }
}

export type PayInvoice = {
  id: string
  invoice_no: string | null
  outlet_name: string | null
  month: string
  items: { name: string; qty: number; unit_price: number }[]
  total: number
  due_date: string | null
  memo: string | null
  status: 'unpaid' | 'paid'
  paid_at: string | null
  created_at: string
  manager_email: string | null
  has_autopay?: boolean // 이미 카드 자동결제가 등록된 매체
}

export async function invoiceByToken(token: string): Promise<PayInvoice | null> {
  if (!isPayToken(token) || !process.env.PAYMENT_DB_SECRET) return null
  const { data, error } = await publicDb().rpc('invoice_by_pay_token', { secret: paymentDbSecret(), p_token: token })
  if (error || !data) return null
  return data as PayInvoice
}
