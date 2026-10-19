'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'

// 해지 관리 (총관리자, billing-safety-2.sql)
const back = (kind: 'ok' | 'error', msg: string): never => redirect(`/support/invoices/terminations?${kind}=${encodeURIComponent(msg)}`)
const needSql = (m: string) => /admin_(terminate|cancel_termination|purge|outlet_media)|function|column/i.test(m) ? 'Supabase에서 billing-safety-2.sql을 먼저 실행해 주세요.' : m

async function superContext() {
  const ctx = await getCmsContext()
  if (!ctx.isSuper) redirect('/support')
  return ctx
}

// 해지 처리: 자동 청구·자동결제를 멈추고 30일 뒤 지울 날을 정한다 (자료는 그동안 그대로, 내보내기 가능)
export async function terminateOutlet(id: string, form: FormData) {
  const { supabase } = await superContext()
  const reason = String(form.get('reason') ?? '').trim().slice(0, 300)
  if (!reason) back('error', '해지 사유를 적어 주세요. (예: 고객 요청 해지, 미납 해지)')
  const { data, error } = await supabase.rpc('admin_terminate_outlet', { o: id, p_reason: reason })
  if (error) back('error', needSql(error.message))
  revalidatePath('/support', 'layout')
  back('ok', `${data ?? '매체'} 해지 처리했습니다. 자동 청구·자동결제를 멈췄고, 30일 뒤 자료를 지울 수 있습니다. 환불할 금액이 있으면 청구서에서 환불해 주세요.`)
}

export async function cancelTermination(id: string) {
  const { supabase } = await superContext()
  const { error } = await supabase.rpc('admin_cancel_termination', { o: id })
  if (error) back('error', needSql(error.message))
  revalidatePath('/support', 'layout')
  back('ok', '해지를 취소했습니다. 자동 청구와 자동결제는 다시 켜야 합니다 (자동 청구 화면·고객 결제 정보).')
}

// 자료 지우기 (지울 날이 지난 해지 매체): 사진 파일 → 매체 자료 순으로. 청구서·결제 기록은 남는다
export async function purgeOutlet(id: string, form: FormData) {
  const { supabase } = await superContext()
  const typed = String(form.get('confirm_name') ?? '').trim()
  const { data: o } = await supabase.from('outlets').select('name, purge_after').eq('id', id).maybeSingle()
  if (!o) back('error', '매체를 찾지 못했습니다.')
  if (typed !== o!.name) back('error', `확인을 위해 매체 이름(${o!.name})을 정확히 적어 주세요.`)
  // 사진: 그 매체 폴더에서 다른 매체 기사가 쓰지 않는 것만
  const { data: files, error: fErr } = await supabase.rpc('admin_outlet_media', { o: id })
  if (fErr) back('error', needSql(fErr.message))
  const names = ((files ?? []) as unknown[]).map((f) => (typeof f === 'string' ? f : String(Object.values(f as object)[0] ?? ''))).filter(Boolean)
  let removed = 0
  for (let i = 0; i < names.length; i += 500) {
    const chunk = names.slice(i, i + 500)
    const { data: gone, error } = await supabase.storage.from('media').remove(chunk)
    if (error) back('error', `사진 파일을 지우다 멈췄습니다 (${removed}개 지움). 다시 눌러 이어서 지워 주세요: ${error.message}`)
    removed += gone?.length ?? 0
  }
  // 영상: 같은 방식으로 (video-storage.sql 전이면 목록 함수가 없으므로 건너뛴다)
  const { data: vids, error: vErr } = await supabase.rpc('admin_outlet_videos', { o: id })
  if (!vErr) {
    const vnames = ((vids ?? []) as unknown[]).map((f) => (typeof f === 'string' ? f : String(Object.values(f as object)[0] ?? ''))).filter(Boolean)
    for (let i = 0; i < vnames.length; i += 100) {
      const { data: gone, error } = await supabase.storage.from('videos').remove(vnames.slice(i, i + 100))
      if (error) back('error', `영상 파일을 지우다 멈췄습니다 (${removed}개 지움). 다시 눌러 이어서 지워 주세요: ${error.message}`)
      removed += gone?.length ?? 0
    }
  }
  const { error } = await supabase.rpc('admin_purge_outlet', { o: id, p_files: removed })
  if (error) back('error', needSql(error.message))
  revalidatePath('/', 'layout')
  back('ok', `${o!.name} 자료를 지웠습니다 (사진·영상 ${removed}개). 청구서·결제 기록은 5년 동안 남겨 둡니다.`)
}
