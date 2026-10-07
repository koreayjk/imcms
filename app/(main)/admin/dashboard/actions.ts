'use server'

import { redirect } from 'next/navigation'
import { deleteGroup, deleteOutlet } from '../outlets/actions'

// 운영 대시보드의 지우기 버튼: 결과를 주소에 담아 화면 위에 알린다
function back(r: { ok?: string; error?: string }): never {
  redirect(`/admin/dashboard?${r.error ? 'error' : 'ok'}=${encodeURIComponent(r.error ?? r.ok ?? '')}`)
}

export async function removeGroup(id: string) {
  back(await deleteGroup(id))
}

export async function removeOutlet(id: string) {
  back(await deleteOutlet(id))
}
