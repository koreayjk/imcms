import { NextResponse, type NextRequest } from 'next/server'
import { createPayLinkCheckout } from '@/lib/pay-link-checkout'

export const dynamic = 'force-dynamic'

// 청구서 메일의 "결제하기" 버튼: 누르면 바로 Stripe 결제창으로 간다 (로그인·중간 화면 없음). 실패하면 청구서 화면에 이유를 보여 준다
export async function GET(req: NextRequest, props: { params: Promise<{ token: string }> }) {
  const { token } = await props.params
  const r = await createPayLinkCheckout(token)
  if (r.ok) return NextResponse.redirect(r.url, 303)
  const back = new URL(`/pay/${token}`, req.nextUrl.origin)
  back.searchParams.set('error', r.error)
  return NextResponse.redirect(back, 303)
}
