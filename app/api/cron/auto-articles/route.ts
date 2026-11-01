import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runAutoArticle } from '@/lib/auto-press'

// Supabase 예약 작업(auto-press-articles.sql)이 매시간 정각에 매체마다 한 번씩 부른다 (?outlet=<매체ID>)
// 로그인이 없으므로 DB 안의 비밀 열쇠로 확인한다. 현지 시간대·하루 건수는 runAutoArticle 이 확인한다
export const preferredRegion = 'iad1'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  const outlet = req.nextUrl.searchParams.get('outlet')
  if (!secret || !outlet || !process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!/^[0-9a-f-]{36}$/i.test(outlet)) return NextResponse.json({ error: 'bad outlet' }, { status: 400 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: allowed } = await supabase.rpc('press_cron_check', { secret })
  if (allowed !== true) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const result = await runAutoArticle(supabase, secret, outlet, { force: req.nextUrl.searchParams.get('force') === '1' })
  return NextResponse.json({ at: new Date().toISOString(), ...result })
}
