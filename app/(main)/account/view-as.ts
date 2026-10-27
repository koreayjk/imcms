'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { getCmsContext, VIEW_AS_COOKIE } from '@/lib/cms'
import { getT } from '@/lib/cms-t'

// 보기 모드 바꾸기: 편집장·기자(운영팀은 발행인도) 화면으로 본다. 'off' 는 원래대로.
//   화면 구성만 바뀐다. 실제 권한은 그대로다 (lib/cms.ts)
export async function setViewAs(mode: 'off' | 'group' | 'editor' | 'reporter'): Promise<{ error?: string }> {
  const { canViewAs, real } = await getCmsContext()
  const { t } = await getT()
  if (!canViewAs) return { error: t('운영팀과 발행인만 쓸 수 있습니다.', 'Only the IM Newsroom team and Publishers can use this.') }
  const jar = await cookies()
  if (mode === 'off') jar.delete(VIEW_AS_COOKIE)
  else if (mode === 'editor' || mode === 'reporter' || (mode === 'group' && real.isStaff)) jar.set(VIEW_AS_COOKIE, mode, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 60 * 60 * 12 })
  else return { error: t('고를 수 없는 보기입니다.', 'That view is not available.') }
  revalidatePath('/', 'layout')
  return {}
}
