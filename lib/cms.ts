import { cache } from 'react'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
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
  // 체험 계정 (trial.sql): 기간이 끝나면 정식 신청 안내로
  const trialUntil = (profile?.trial_until as string | null | undefined) ?? null
  if (trialUntil && Date.parse(trialUntil) < Date.now()) redirect('/trial/ended')
  const trial = trialUntil
    ? { until: trialUntil, daysLeft: Math.max(0, Math.ceil((Date.parse(trialUntil) - Date.now()) / 86_400_000)), role }
    : null

  // groups.sql 실행 전 DB에는 is_super·publisher_id 칸이 없다 → 예전처럼 관리자 = 총관리자로 본다
  const legacy = profile && !('is_super' in profile)
  const isSuper = legacy ? role === 'admin' : !!profile?.is_super
  const isGroupAdmin = isSuper || (role === 'admin' && !!profile?.publisher_id)
  // 운영팀 = 총관리자 + IM 뉴스룸 매니저 (상담·업무요청 처리, 대시보드)
  const isStaff = isSuper || !!profile?.is_staff
  // 매니저는 매체에 소속되지 않는다: 고객사 수정 요청을 처리할 매체는 상단에서 골라 쿠키에 기억한다
  //   (소속이 아니므로 그 매체의 기사 쓰기·회원 권한은 DB가 계속 막는다)
  const staffPick = isStaff && !isSuper ? cookies().get(STAFF_OUTLET_COOKIE)?.value ?? null : null
  const outletId = staffPick && /^[0-9a-f-]{36}$/.test(staffPick)
    ? staffPick
    : ((profile?.outlet_id as string | null) ?? null)

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
    // 홈페이지 꾸미기(섹션·홈 편집판·광고): 편집장 이상 + 운영팀(매니저)
    canEditSite: role === 'editor' || role === 'admin' || isSuper || isStaff,
    // 체험 계정이면 남은 기간·지금 역할 (아니면 null)
    trial,
  }
})

// 매니저가 작업 중인 고객사 매체 (상단 매체 선택)
export const STAFF_OUTLET_COOKIE = 'im_staff_outlet'

// 관리자 승인 전 가입자는 편집국에 들어올 수 없다 (DB에서도 막혀 있음)
export function isApproved(profile: { role?: string | null; approved?: boolean | null; is_super?: boolean | null } | null) {
  if (!profile) return false
  return !!profile.is_super || profile.role === 'admin' || profile.approved !== false
}
