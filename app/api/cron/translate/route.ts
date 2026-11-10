import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { revalidateTag } from 'next/cache'
import { activeModel } from '@/lib/ai-draft'
import { translateToEnglish } from '@/lib/translate'
import { outletTag } from '@/lib/outlet-cache'

// Supabase 예약 작업(article-translations.sql)이 1분마다 부른다.
//   번역이 없거나 낡은 발행 기사를 최신순으로 몇 건 영어로 번역해 article_translations 에 저장한다 (번역을 켠 매체만)
export const maxDuration = 60
export const dynamic = 'force-dynamic'

const BATCH = 5            // 한 번에 동시에 번역하는 기사 수
const BUDGET_MS = 50_000   // 이 시간 안에 못 끝낸 기사는 다음 번에

type Pending = { id: string; outlet_id: string; title: string; excerpt: string | null; body: string; src_hash: string }

export async function GET(req: NextRequest) {
  const started = Date.now()
  const secret = req.headers.get('x-cron-secret')
  if (!secret || !process.env.NEXT_PUBLIC_SUPABASE_URL) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: allowed } = await supabase.rpc('press_cron_check', { secret })
  if (allowed !== true) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const model = activeModel()
  if (!model) return NextResponse.json({ error: 'AI 키가 없습니다' }, { status: 500 })

  const { data, error } = await supabase.rpc('translate_pending', { secret, n: BATCH })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const todo = (data ?? []) as Pending[]
  if (!todo.length) return NextResponse.json({ at: new Date().toISOString(), pending: 0, done: 0 })

  let done = 0
  let failed = 0
  const outlets = new Set<string>()
  await Promise.all(todo.map(async (a) => {
    const left = BUDGET_MS - (Date.now() - started)
    try {
      const t = await translateToEnglish(model, { title: a.title, excerpt: a.excerpt, body: a.body }, Math.max(15_000, left))
      const { error: se } = await supabase.rpc('translate_save', { secret, p_article: a.id, p_title: t.title, p_excerpt: t.excerpt, p_body: t.body, p_hash: a.src_hash, p_model: model.id })
      if (se) throw new Error(se.message)
      done++
      outlets.add(a.outlet_id)
    } catch (e) {
      failed++
      await supabase.rpc('translate_fail', { secret, p_article: a.id, p_error: e instanceof Error ? e.message : '번역 실패' })
    }
  }))
  // 번역이 새로 생기면 그 매체의 홈페이지 캐시를 비운다 (영어판이 바로 보이게)
  for (const id of outlets) { try { revalidateTag(outletTag(id), { expire: 0 }) } catch { /* 캐시를 못 비워도 1분 뒤 반영 */ } }
  return NextResponse.json({ at: new Date().toISOString(), pending: todo.length, done, failed, model: model.id, ms: Date.now() - started })
}
