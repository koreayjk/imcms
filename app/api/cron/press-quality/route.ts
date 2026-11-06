import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ensureFullBody, type PressRelease } from '@/lib/press'
import { judgePress } from '@/lib/press-quality'

// Supabase 예약 작업(press-quality.sql)이 5분마다 부른다.
//   아직 판정하지 않은 보도자료를 최신순으로 상세 페이지까지 읽어, 글이 충분하고 사진이 있는지 판정해 저장한다
export const preferredRegion = 'icn1'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const BATCH = 10          // 한 번에 동시에 읽는 개수 (지자체 사이트에 부담을 주지 않게)
const BUDGET_MS = 42_000  // 이 시간이 지나면 새 묶음을 시작하지 않는다

type Pending = PressRelease & { quality_tries: number }
type Out = { id: string; body_html: string | null; image_url: string | null; quality: 'ok' | 'poor' | 'retry'; note: string }

export async function GET(req: NextRequest) {
  const started = Date.now()
  const secret = req.headers.get('x-cron-secret')
  if (!secret || !process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: allowed } = await supabase.rpc('press_cron_check', { secret })
  if (allowed !== true) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data: pending, error } = await supabase.rpc('press_quality_pending', { secret, n: 200 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const todo = (pending ?? []) as Pending[]

  const outs: Out[] = []
  for (let i = 0; i < todo.length && Date.now() - started < BUDGET_MS; i += BATCH) {
    const done = await Promise.all(todo.slice(i, i + BATCH).map(async (r): Promise<Out> => {
      try {
        let patch: { body_html: string | null; image_url: string | null } | null = null
        const full = await ensureFullBody(supabase, r, async (_id, p) => { patch = p })
        const html = patch ? (patch as { body_html: string | null }).body_html : full.body_html
        const image = patch ? (patch as { image_url: string | null }).image_url : full.image_url
        // 본문을 읽지 못했으면 몇 번 더 시도한다 (사이트가 잠깐 막혔을 수 있다)
        if (!html) return { id: r.id, body_html: null, image_url: null, quality: 'retry', note: '본문을 읽지 못함' }
        const q = judgePress(r.source_key, html, image)
        return { id: r.id, body_html: html, image_url: image, quality: q.ok ? 'ok' : 'poor', note: q.note }
      } catch (e) {
        return { id: r.id, body_html: null, image_url: null, quality: 'retry', note: e instanceof Error ? e.message.slice(0, 80) : '오류' }
      }
    }))
    outs.push(...done)
  }
  if (outs.length) {
    const { error: e2 } = await supabase.rpc('press_quality_apply', { secret, p_rows: outs })
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  }
  const count = (q: Out['quality']) => outs.filter((o) => o.quality === q).length
  return NextResponse.json({ at: new Date().toISOString(), pending: todo.length, judged: outs.length, ok: count('ok'), poor: count('poor'), retry: count('retry'), ms: Date.now() - started })
}
