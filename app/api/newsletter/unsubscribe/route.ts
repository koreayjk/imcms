import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 메일 프로그램의 “수신거부” 버튼 (List-Unsubscribe-Post: One-Click). POST 로만 처리한다
export async function POST(req: NextRequest) {
  const t = req.nextUrl.searchParams.get('t') ?? ''
  if (!/^[0-9a-f]{20,64}$/.test(t) || !process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({ ok: false }, { status: 400 })
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  await supabase.rpc('newsletter_unsubscribe', { p_token: t })
  return NextResponse.json({ ok: true })
}
