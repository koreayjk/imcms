'use server'

import { revalidatePath } from 'next/cache'
import { getCmsContext } from '@/lib/cms'

// 광고문의 처리 표시·삭제 (편집장 이상, DB 권한이 한 번 더 막는다)
export async function setInquiryStatus(id: string, status: 'new' | 'done') {
  const { supabase, isEditorPlus, isStaff } = await getCmsContext()
  if (!isEditorPlus && !isStaff) return
  await supabase.from('site_inquiries').update({ status }).eq('id', id)
  revalidatePath('/admin/inquiries', 'layout')
}

export async function deleteInquiry(id: string) {
  const { supabase, isEditorPlus, isStaff } = await getCmsContext()
  if (!isEditorPlus && !isStaff) return
  await supabase.from('site_inquiries').delete().eq('id', id)
  revalidatePath('/admin/inquiries', 'layout')
}
