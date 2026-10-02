import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 기사 조회수 +1 (기사 페이지에서 한 번 부른다). 검색 로봇·미리보기 봇은 세지 않는다
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|kakaotalk-scrap|yeti|daum|headless|lighthouse/i

export async function POST(request: NextRequest) {
  if (BOT.test(request.headers.get('user-agent') ?? '')) return NextResponse.json({ ok: true, skipped: 'bot' })
  const { id } = (await request.json().catch(() => ({}))) as { id?: string }
  if (!id || !/^[0-9a-f-]{36}$/.test(id) || !process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({ ok: false }, { status: 400 })
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  await supabase.rpc('increment_article_view', { p_id: id })
  return NextResponse.json({ ok: true })
}
