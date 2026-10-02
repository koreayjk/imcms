import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recordPayment } from '@/lib/payments'
import { getPayment, tossReady } from '@/lib/toss'

// 토스페이먼츠 웹훅 (개발자센터 → 웹훅에 https://imcms.vercel.app/api/payments/webhook 등록, PAYMENT_STATUS_CHANGED)
//   결제 웹훅에는 서명이 없어서, 받은 내용을 믿지 않고 토스페이먼츠에 결제를 다시 조회한 결과만 기록한다
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  if (!tossReady() || !process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({ ok: true })
  const body = (await req.json().catch(() => null)) as { eventType?: string; data?: { paymentKey?: string; orderId?: string } } | null
  const key = body?.data?.paymentKey
  if (body?.eventType !== 'PAYMENT_STATUS_CHANGED' || !key || !/^[A-Za-z0-9_-]{1,200}$/.test(key)) return NextResponse.json({ ok: true })
  // 우리 주문만 (IMN-/IMA- 로 시작)
  if (body.data?.orderId && !/^IM[NA]-/.test(body.data.orderId)) return NextResponse.json({ ok: true })
  try {
    const p = await getPayment(key)
    if (!/^IM[NA]-/.test(p.orderId)) return NextResponse.json({ ok: true })
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
    await recordPayment(supabase, p)
  } catch {
    // 조회 실패: 200 으로 받고 넘긴다 (승인 화면에서 이미 기록했거나, 다음 재전송 때 다시 확인)
  }
  return NextResponse.json({ ok: true })
}
