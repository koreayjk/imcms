import { getCmsContext } from '@/lib/cms'

// 편집국 속도 점검 (운영팀만): 서버 ↔ Supabase 왕복 시간을 잰다. 화면이 느릴 때 원인이 거리인지 보려고 쓴다
export const dynamic = 'force-dynamic'

export async function GET() {
  const t0 = Date.now()
  const { supabase, user, isStaff } = await getCmsContext()
  const ctxMs = Date.now() - t0
  if (!isStaff) return Response.json({ error: '운영팀만 볼 수 있습니다.' }, { status: 403 })
  const time = async (f: () => PromiseLike<unknown>) => { const s = Date.now(); await f(); return Date.now() - s }
  const authMs = await time(() => supabase.auth.getUser())
  const dbMs: number[] = []
  for (let i = 0; i < 5; i++) dbMs.push(await time(() => supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()))
  const sorted = [...dbMs].sort((a, b) => a - b)
  return Response.json({
    서버지역: process.env.VERCEL_REGION ?? '알 수 없음',
    '회원 확인(편집국 화면 준비) ms': ctxMs,
    '인증 서버 한 번 ms': authMs,
    'DB 한 번 왕복 ms (5회)': dbMs,
    'DB 왕복 가운데값 ms': sorted[2],
  }, { headers: { 'Cache-Control': 'no-store' } })
}
