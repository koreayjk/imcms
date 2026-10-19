'use server'

import { revalidateTag } from 'next/cache'
import { getCmsContext } from '@/lib/cms'

// 카테고리를 바꾼 뒤 신문 홈페이지 메뉴를 바로 새로 읽게 한다 (그냥 두면 5분 뒤에 바뀐다)
export async function refreshSiteMenu() {
  const { canEditSite } = await getCmsContext()
  if (!canEditSite) return
  revalidateTag('sites', { expire: 0 })
}
