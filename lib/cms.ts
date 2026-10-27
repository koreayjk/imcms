import { cache } from 'react'
import { redirect } from 'next/navigation'
import { cookies, headers } from 'next/headers'
import { createServerSupabaseClient } from './supabase-server'
import type { UserRole } from './types'
import { hasVerifiedFactor, mfaExpired, mfaSession, tokenClaims } from './mfa'
import { VERIFIED_USER_HEADER, readVerifiedUser } from './verified-user'
import { parseCmsLang, type CmsLang } from './cms-i18n'

// 한 번의 요청 안에서는 레이아웃과 페이지가 같은 결과를 나눠 쓴다 (로그인 확인·회원 정보 조회를 두 번 하지 않도록)
export const getCmsContext = cache(async function getCmsContext() {
  const supabase = await createServerSupabaseClient()
  // proxy가 방금 확인한 회원이면 그대로 쓰고(인증 서버 왕복 한 번 절약), 아니면 인증 서버에 묻는다
  //   로그인 쿠키 속 회원 번호와 같을 때만 쓴다 (DB는 늘 그 쿠키로 권한을 확인한다)
  const { data: { session } } = await supabase.auth.getSession()
  const passed = await readVerifiedUser((await headers()).get(VERIFIED_USER_HEADER), (tokenClaims(session?.access_token) as { sub?: string }).sub)
  const user = passed ?? (await supabase.auth.getUser()).data.user
  if (!user) redirect('/login')

  // 회원 정보와 2단계 인증 필수 여부는 함께 묻는다 (차례로 기다리면 메뉴를 열 때마다 그만큼 느려진다)
  const mfaCheck = !hasVerifiedFactor(user)
  const [{ data: profile }, mfaReq] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    mfaCheck ? supabase.rpc('my_mfa_required') : Promise.resolve({ data: null }),
  ])

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
  const staffPick = isStaff && !isSuper ? (await cookies()).get(STAFF_OUTLET_COOKIE)?.value ?? null : null
  const outletId = staffPick && /^[0-9a-f-]{36}$/.test(staffPick)
    ? staffPick
    : ((profile?.outlet_id as string | null) ?? null)

  // 편집국 언어: 내 정보에서 고른 것(cms-lang.sql) → 매체의 편집국 언어(site.cmsLang) → 한국어
  let lang: CmsLang | null = parseCmsLang((profile as { cms_lang?: string | null } | null)?.cms_lang)
  if (!lang && outletId) {
    const { data: lo } = await supabase.from('outlets').select('site').eq('id', outletId).maybeSingle()
    lang = parseCmsLang((lo?.site as { cmsLang?: string } | null)?.cmsLang)
  }

  // 2단계 인증 (account-security.sql): 코드를 넣은 지 오래됐으면 다시 묻고, 필수인데 아직 안 켰으면 등록 화면으로
  //   필수 = 총관리자·매니저, 발행인이 필수로 정한 그룹의 발행인·편집장 (SQL 실행 전이면 아무것도 바뀌지 않는다)
  if (!trial) {
    if (hasVerifiedFactor(user)) {
      const m = mfaSession(session?.access_token)
      if (!m.aal2) redirect('/login/mfa')
      if (mfaExpired(m.verifiedAt, isStaff)) redirect('/login/mfa?again=1')
    } else if (isStaff || role === 'admin' || role === 'editor') {
      if (mfaReq.data === true) redirect('/login/mfa/setup?required=1')
    }
  }

  // 보기 모드: 운영팀·발행인이 편집장·기자 화면이 어떻게 다른지 보는 용도다. 메뉴와 화면 구성만 그 역할로 보이고,
  //   실제 권한(DB)은 그대로다. 체험 계정은 자체 역할 바꾸기가 있어 쓰지 않는다
  const real = { isSuper, isStaff, isGroupAdmin }
  const canViewAs = !trial && (isStaff || isGroupAdmin)
  const asRaw = canViewAs ? (await cookies()).get(VIEW_AS_COOKIE)?.value : undefined
  const viewAs: ViewAs | null = asRaw === 'group' && isStaff ? 'group' : asRaw === 'editor' || asRaw === 'reporter' ? asRaw : null
  const eff = viewAs
    ? {
        role: (viewAs === 'group' ? 'admin' : viewAs) as UserRole,
        isSuper: false, isStaff: false, isGroupAdmin: viewAs === 'group',
        isEditorPlus: viewAs !== 'reporter', canEditSite: viewAs !== 'reporter',
      }
    : { role, isSuper, isStaff, isGroupAdmin, isEditorPlus: role === 'editor' || role === 'admin' || isSuper, canEditSite: role === 'editor' || role === 'admin' || isSuper || isStaff }

  // 보기 모드: 지금 보는 매체가 속한 그룹만 보이게 한다 (운영팀이 보는 다른 그룹·매체 자료가 섞여 나오지 않도록)
  //   진짜 발행인·편집장·기자가 보는 범위와 같게 맞춘다. 실제 권한(DB)은 그대로다
  let viewGroupId: string | null = null
  if (viewAs && outletId) {
    const { data: vo } = await supabase.from('outlets').select('publisher_id').eq('id', outletId).maybeSingle()
    viewGroupId = (vo as { publisher_id?: string | null } | null)?.publisher_id ?? null
  }

  return {
    supabase,
    user,
    // 편집국(관리 화면) 언어
    lang: lang ?? ('ko' as CmsLang),
    profile: viewAs && profile ? { ...profile, role: eff.role, is_super: false, is_staff: false } : profile,
    outletId,
    // 총관리자: 모든 그룹 / 발행인: 자기 그룹 / 편집장: 자기 매체
    isSuper: eff.isSuper,
    isGroupAdmin: eff.isGroupAdmin,
    isStaff: eff.isStaff,
    publisherId: viewAs ? viewGroupId : ((profile?.publisher_id as string | null) ?? null),
    // 보기 모드일 때 보는 매체의 그룹 (보기 모드가 아니면 null)
    viewGroupId,
    isEditorPlus: eff.isEditorPlus,
    // 홈페이지 꾸미기(섹션·홈 편집판·광고): 편집장 이상 + 운영팀(매니저)
    canEditSite: eff.canEditSite,
    // 체험 계정이면 남은 기간·지금 역할 (아니면 null)
    trial,
    // 보기 모드: 지금 보는 역할(없으면 null)과 이 계정이 쓸 수 있는지, 진짜 권한
    viewAs, canViewAs, real,
  }
})

// 보기 모드: 편집장·기자(운영팀은 발행인도) 화면으로 보기 (쿠키)
export const VIEW_AS_COOKIE = 'im_view_as'
export type ViewAs = 'group' | 'editor' | 'reporter'

// 매니저가 작업 중인 고객사 매체 (상단 매체 선택)
export const STAFF_OUTLET_COOKIE = 'im_staff_outlet'

// 관리자 승인 전 가입자는 편집국에 들어올 수 없다 (DB에서도 막혀 있음)
export function isApproved(profile: { role?: string | null; approved?: boolean | null; is_super?: boolean | null } | null) {
  if (!profile) return false
  return !!profile.is_super || profile.role === 'admin' || profile.approved !== false
}
