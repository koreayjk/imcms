'use server'

import { getCmsContext } from '@/lib/cms'
import { sanitizeBody } from '@/lib/article-html'
import { isDemo } from '@/lib/public-data'

// 미리보기 본문도 실제 홈페이지와 똑같이 정리해서 보여 준다
export async function previewBody(html: string) {
  if (!isDemo) await getCmsContext()
  return sanitizeBody(html.slice(0, 1_000_000))
}
