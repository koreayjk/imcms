'use server'

import { revalidatePath } from 'next/cache'
import { getCmsContext } from '@/lib/cms'

export type DeleteResult = { deleted: number; inUse: number; noPermission: number; failed: number; error?: string }

// 저장 파일 지우기: 기사·수정 이력·광고 배너·로고에서 쓰는 파일과 남의 파일(기자)은 DB 함수가 걸러낸다.
//   마지막 삭제는 로그인한 본인 권한(RLS)으로 하므로, 여기서 권한을 넓히지 않는다
export async function deleteFiles(outletId: string, bucket: string, names: string[]): Promise<DeleteResult> {
  const none: DeleteResult = { deleted: 0, inUse: 0, noPermission: 0, failed: 0 }
  if (bucket !== 'media' && bucket !== 'videos') return { ...none, error: '저장소를 확인해 주세요.' }
  const list = Array.from(new Set(names)).slice(0, 100)
  if (!list.length) return { ...none, error: '지울 파일을 골라 주세요.' }
  if (list.some((n) => typeof n !== 'string' || !n.startsWith(`${outletId}/`) || n.includes('..'))) return { ...none, error: '이 매체의 파일만 지울 수 있습니다.' }

  const { supabase, outletId: mine, isSuper } = await getCmsContext()
  if (!isSuper && mine !== outletId) return { ...none, error: '이 매체의 파일은 지울 수 없습니다.' }

  const { data, error } = await supabase.rpc('outlet_file_status', { o: outletId, p_names: list })
  if (error) return { ...none, error: /outlet_file_status|function/i.test(error.message) ? '저장 파일 관리 설정이 아직 끝나지 않았습니다. 운영팀이 media-manager.sql을 실행해야 합니다.' : error.message }
  const rows = (data ?? []) as { file_name: string; can_delete: boolean; in_use: boolean }[]
  const ok = rows.filter((r) => r.can_delete && !r.in_use).map((r) => r.file_name)
  const inUse = rows.filter((r) => r.in_use).length
  const noPermission = rows.filter((r) => !r.can_delete).length

  let deleted = 0
  for (let i = 0; i < ok.length; i += 100) {
    const { data: gone, error: e } = await supabase.storage.from(bucket).remove(ok.slice(i, i + 100))
    if (e) return { deleted, inUse, noPermission, failed: ok.length - deleted, error: `지우다 멈췄습니다: ${e.message}` }
    deleted += gone?.length ?? 0
  }
  revalidatePath('/media')
  return { deleted, inUse, noPermission, failed: ok.length - deleted }
}
