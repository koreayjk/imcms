import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { collectSource } from '@/lib/press'
import { PRESS_SOURCES } from '@/lib/press-sources'

// Supabase 예약 작업(press-cron.sql)이 30분마다 부른다. 로그인 없이 동작하므로 DB 안의 비밀 열쇠로 확인한다
export const preferredRegion = 'icn1'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || !process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data: allowed } = await supabase.rpc('press_cron_check', { secret })
  if (allowed !== true) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const results = await Promise.all(
    PRESS_SOURCES.map(async (s) => {
      const r = await collectSource(s)
      const { data, error } = await supabase.rpc('press_ingest', {
        secret,
        p_source_key: s.key,
        p_ok: r.ok,
        p_message: r.message,
        p_rows: r.rows,
      })
      return { source: s.key, ok: r.ok && !error, added: typeof data === 'number' ? data : 0, message: error?.message ?? r.message }
    })
  )
  return NextResponse.json({ at: new Date().toISOString(), results })
}
