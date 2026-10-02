import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 배너 노출 +1 (한 페이지에서 보인 배너를 모아 한 번에). 검색 로봇은 세지 않는다
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|kakaotalk-scrap|yeti|daum|headless|lighthouse/i

export async function POST(request: NextRequest) {
  if (BOT.test(request.headers.get('user-agent') ?? '')) return NextResponse.json({ ok: true, skipped: 'bot' })
  const { ids } = (await request.json().catch(() => ({}))) as { ids?: unknown }
  const clean = Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string' && /^[0-9a-f-]{36}$/.test(x)).slice(0, 12) : []
  if (!clean.length || !process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({ ok: false }, { status: 400 })
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  await supabase.rpc('ad_track_views', { ids: clean })
  return NextResponse.json({ ok: true })
}
