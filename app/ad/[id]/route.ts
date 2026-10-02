import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// 배너 클릭: 클릭 수를 세고 광고주 주소로 보낸다 (검색 로봇은 세지 않고 보내기만)
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|kakaotalk-scrap|yeti|daum|headless|lighthouse/i

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const home = new URL('/', request.url)
  if (!/^[0-9a-f-]{36}$/.test(params.id) || !process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.redirect(home)
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  const bot = BOT.test(request.headers.get('user-agent') ?? '')
  const { data } = await supabase.rpc(bot ? 'ad_link' : 'ad_click', { bid: params.id })
  const url = typeof data === 'string' && /^https?:\/\//i.test(data) ? data : null
  return NextResponse.redirect(url ?? home, { status: 302, headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' } })
}
