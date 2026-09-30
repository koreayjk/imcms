import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from './supabase-server'
import type { UserRole } from './types'

// 한 번의 요청 안에서는 레이아웃과 페이지가 같은 결과를 나눠 쓴다 (로그인 확인·회원 정보 조회를 두 번 하지 않도록)
export const getCmsContext = cache(async function getCmsContext() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const role = (profile?.role ?? 'reporter') as UserRole
  if (!isApproved(profile)) redirect('/pending')

  const outletId = (profile?.outlet_id as string | null) ?? null
  // groups.sql 실행 전 DB에는 is_super·publisher_id 칸이 없다 → 예전처럼 관리자 = 총관리자로 본다
  const legacy = profile && !('is_super' in profile)
  const isSuper = legacy ? role === 'admin' : !!profile?.is_super
  const isGroupAdmin = isSuper || (role === 'admin' && !!profile?.publisher_id)
  // 운영팀 = 총관리자 + IM 뉴스룸 매니저 (상담·업무요청 처리, 대시보드)
  const isStaff = isSuper || !!profile?.is_staff

  return {
    supabase,
    user,
    profile,
    outletId,
    // 총관리자: 모든 그룹 / 발행인: 자기 그룹 / 편집장: 자기 매체
    isSuper,
    isGroupAdmin,
    isStaff,
    publisherId: (profile?.publisher_id as string | null) ?? null,
    isEditorPlus: role === 'editor' || role === 'admin' || isSuper,
  }
})

// 관리자 승인 전 가입자는 편집국에 들어올 수 없다 (DB에서도 막혀 있음)
export function isApproved(profile: { role?: string | null; approved?: boolean | null; is_super?: boolean | null } | null) {
  if (!profile) return false
  return !!profile.is_super || profile.role === 'admin' || profile.approved !== false
}
