'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import { ROLE_LABEL, type UserRole } from '@/lib/types'
import { PRODUCT } from '@/lib/product'
import { sendInviteMail } from '@/lib/invite-mail'

const ROLES: UserRole[] = ['reporter', 'editor', 'admin']
export type FormState = { error?: string; ok?: string }

async function groupContext() {
  const ctx = await getCmsContext()
  if (!ctx.isGroupAdmin) redirect('/newsroom')
  const { t } = await getT()
  return { ...ctx, t }
}

function fail(message: string): never {
  redirect(`/admin/users?error=${encodeURIComponent(message)}`)
}

// 발행인은 매체가 아니라 그룹 전체를 맡으므로 그룹 표시(publisher_id)가 필요하다
async function publisherOf(supabase: Awaited<ReturnType<typeof getCmsContext>>['supabase'], outletId: string | null) {
  if (!outletId) return null
  const { data } = await supabase.from('outlets').select('publisher_id').eq('id', outletId).maybeSingle()
  return ((data as any)?.publisher_id as string | null) ?? null
}

export async function approveUser(id: string, form: FormData) {
  // 총관리자는 모든 가입 신청, 발행인은 우리 그룹 매체로 신청한 사람만 (DB가 한 번 더 확인한다)
  const { supabase, isSuper, t } = await groupContext()
  const roleInput = String(form.get('role') ?? 'reporter')
  const outletId = String(form.get('outlet_id') ?? '') || null
  // IM 뉴스룸 매니저: 매체에 속하지 않고 상담·업무요청을 처리한다
  if (roleInput === 'staff') {
    if (!isSuper) fail(t('매니저 지정은 총관리자만 할 수 있습니다.', 'Only a Super Admin can appoint a Manager.'))
    const { error } = await supabase.from('profiles').update({ approved: true, is_staff: true, role: 'reporter', outlet_id: null, publisher_id: null }).eq('id', id)
    if (error) fail(/is_staff/.test(error.message) ? t('매니저를 두려면 staff.sql을 실행해 주세요.', 'To have Managers, run staff.sql.') : t(`승인하지 못했습니다: ${error.message}`, `Could not approve: ${error.message}`))
    revalidatePath('/', 'layout')
    return
  }
  const role = roleInput as UserRole
  if (!ROLES.includes(role)) fail(t('역할을 확인해 주세요.', 'Check the role.'))
  if (!outletId) fail(t('소속 매체를 정해주세요.', 'Choose the outlet they belong to.'))
  const publisher_id = role === 'admin' ? await publisherOf(supabase, outletId) : null
  const { data: done, error } = await supabase.from('profiles').update({ approved: true, role, outlet_id: outletId, publisher_id }).eq('id', id).select('id')
  if (error) fail(/row-level security|권한/.test(error.message) ? t('우리 그룹 매체로만 승인할 수 있습니다.', 'You can only approve for your own group\'s outlets.') : t(`승인하지 못했습니다: ${error.message}`, `Could not approve: ${error.message}`))
  if (!done?.length) fail(t('이 가입 신청을 승인할 권한이 없습니다.', 'You do not have permission to approve this sign-up request.'))
  revalidatePath('/', 'layout')
}

export async function rejectUser(id: string) {
  const { supabase, t } = await groupContext()
  const { error } = await supabase.rpc('admin_reject_user', { target: id })
  if (error) fail(t(`거절하지 못했습니다: ${error.message}`, `Could not decline: ${error.message}`))
  revalidatePath('/', 'layout')
}

// 체험 계정을 정식 고객사 매체로 옮기면 체험 표시(trial_until)를 지운다. 안 지우면 7일이 지난 뒤 "체험이 끝났습니다" 화면에 막히고 30일 뒤 자동으로 지워진다
//   체험용 신문에만 남아 있는 경우는 그대로 둔다. 체험 표(trial.sql)가 없거나 권한이 없으면 조용히 넘어간다
async function endTrialIfMoved(supabase: Awaited<ReturnType<typeof groupContext>>['supabase'], id: string, outletIds: (string | null)[]) {
  const ids = outletIds.filter((x): x is string => !!x)
  if (!ids.length) return
  try {
    const { data: trialOutlet } = await supabase.rpc('trial_outlet')
    if (typeof trialOutlet === 'string' && ids.every((x) => x === trialOutlet)) return
    await supabase.from('profiles').update({ trial_until: null }).eq('id', id).not('trial_until', 'is', null)
  } catch {
    /* 체험 기능이 없는 DB */
  }
}

export async function setMember(id: string, input: { role: UserRole; outletId: string | null; fullName?: string }): Promise<FormState> {
  const { supabase, user, t } = await groupContext()
  if (!ROLES.includes(input.role)) return { error: t('역할을 확인해 주세요.', 'Check the role.') }
  if (id === user.id && input.role !== 'admin') return { error: t('내 발행인 권한은 스스로 내릴 수 없습니다.', 'You cannot remove your own Publisher access.') }
  const row: Record<string, unknown> = {
    role: input.role,
    outlet_id: input.outletId,
    publisher_id: input.role === 'admin' ? await publisherOf(supabase, input.outletId) : null,
  }
  if (input.fullName !== undefined) {
    const n = input.fullName.trim().replace(/\s+/g, ' ').slice(0, 30)
    if (n) row.full_name = n
  }
  if (input.role === 'admin' && !row.publisher_id) return { error: t('발행인은 그룹이 있는 매체를 골라야 합니다.', 'A Publisher must be assigned to an outlet that belongs to a group.') }
  const { error } = await supabase.from('profiles').update(row).eq('id', id)
  if (error) return { error: error.message }
  await endTrialIfMoved(supabase, id, [input.outletId])
  revalidatePath('/', 'layout')
  return { ok: t('저장했습니다.', 'Saved.') }
}

// 기자·편집장의 소속 매체와 매체별 직급 (같은 그룹 매체만, outlet-members.sql)
export type Membership = { outletId: string; role: 'reporter' | 'editor' }
export async function setMemberships(id: string, items: Membership[], fullName?: string): Promise<FormState> {
  const { supabase, user, t } = await groupContext()
  if (id === user.id) return { error: t('내 소속은 스스로 바꿀 수 없습니다.', 'You cannot change your own outlet assignments.') }
  if (!items.length) return { error: t('소속 매체를 하나 이상 정해 주세요.', 'Choose at least one outlet.') }
  if (new Set(items.map((i) => i.outletId)).size !== items.length) return { error: t('같은 매체가 두 번 들어 있습니다.', 'The same outlet appears twice.') }
  const { error } = await supabase.rpc('admin_set_memberships', {
    target: id,
    items: items.map((i) => ({ outlet_id: i.outletId, role: i.role })),
  })
  if (error) return { error: /admin_set_memberships|outlet_members/.test(error.message) ? t('여러 매체 소속을 쓰려면 outlet-members.sql을 실행해 주세요.', 'To assign people to multiple outlets, run outlet-members.sql.') : error.message }
  const n = fullName?.trim().replace(/\s+/g, ' ').slice(0, 30)
  if (n) await supabase.from('profiles').update({ full_name: n }).eq('id', id)
  await endTrialIfMoved(supabase, id, items.map((i) => i.outletId))
  revalidatePath('/', 'layout')
  return { ok: t('저장했습니다.', 'Saved.') }
}

export async function inviteMember(_prev: FormState, form: FormData): Promise<FormState> {
  const { supabase, t } = await groupContext()
  const email = String(form.get('email') ?? '').trim().toLowerCase()
  const full_name = String(form.get('full_name') ?? '').trim().slice(0, 30) || null
  const role = String(form.get('role') ?? 'reporter') as UserRole
  const outlet_id = String(form.get('outlet_id') ?? '') || null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: t('이메일 주소를 확인해 주세요.', 'Check the email address.') }
  if (!ROLES.includes(role)) return { error: t('역할을 골라주세요.', 'Choose a role.') }
  if (!outlet_id) return { error: t('소속 매체를 골라주세요.', 'Choose the outlet they belong to.') }
  const publisher_id = await publisherOf(supabase, outlet_id)
  if (!publisher_id) return { error: t('그룹에 속한 매체를 골라주세요.', 'Choose an outlet that belongs to a group.') }

  const { data, error } = await supabase.from('invitations').insert({ email, full_name, role, outlet_id, publisher_id }).select('accepted_at').single()
  if (error) {
    if (/invitations_open_email|duplicate/i.test(error.message)) return { error: t('이미 초대한 이메일입니다. 아래 초대 목록을 확인하세요.', 'This email has already been invited. Check the invitation list below.') }
    return { error: t(`초대하지 못했습니다: ${error.message}`, `Could not send the invitation: ${error.message}`) }
  }
  revalidatePath('/admin/users')
  if (data?.accepted_at) return { ok: t(`${email}은(는) 이미 가입한 계정이라 바로 적용했습니다.`, `${email} already has an account, so it was applied right away.`) }
  const { data: o } = await supabase.from('outlets').select('name').eq('id', outlet_id).maybeSingle()
  const mailed = await sendInviteMail({ email, fullName: full_name, outletName: o?.name ?? PRODUCT.name, role: ROLE_LABEL[role] })
  return {
    ok: t(
      `${email}을(를) 초대했습니다${mailed ? '. 초대 메일을 보냈습니다' : ' (메일 설정 전이라 초대 메일은 못 보냈습니다. app.imnewsroom.com/signup 주소를 직접 알려 주세요)'}. 이 이메일(또는 같은 주소의 구글 계정)로 가입하면 바로 승인되어 들어옵니다.`,
      `Invited ${email}${mailed ? '. An invitation email was sent' : ' (email is not set up yet, so no invitation email was sent. Please give them the app.imnewsroom.com/signup address yourself)'}. If they sign up with this email (or a Google account with the same address), they are approved and let in right away.`,
    ),
  }
}

export async function cancelInvite(id: string) {
  const { supabase } = await groupContext()
  await supabase.from('invitations').delete().eq('id', id).is('accepted_at', null)
  revalidatePath('/admin/users')
}

// 매니저 지정·해제 (총관리자만, DB에서도 막혀 있음)
export async function setStaff(id: string, on: boolean) {
  const { supabase, isSuper, t } = await groupContext()
  if (!isSuper) fail(t('매니저 지정은 총관리자만 할 수 있습니다.', 'Only a Super Admin can appoint a Manager.'))
  const { error } = await supabase.from('profiles').update(on ? { is_staff: true, approved: true } : { is_staff: false }).eq('id', id)
  if (error) fail(/is_staff/.test(error.message) ? t('매니저를 두려면 staff.sql을 실행해 주세요.', 'To have Managers, run staff.sql.') : error.message)
  revalidatePath('/', 'layout')
}

export async function appointStaff(form: FormData) {
  const id = String(form.get('user_id') ?? '')
  if (id) await setStaff(id, true)
}

// 매니저의 담당 매체 (총관리자만, staff-outlets.sql). 담당 매체에서 들어온 업무요청은 자동으로 그 매니저에게 배정된다
export async function setStaffOutlets(id: string, outletIds: string[]): Promise<FormState> {
  const { supabase, isSuper, t } = await groupContext()
  if (!isSuper) return { error: t('담당 매체는 총관리자만 정할 수 있습니다.', 'Only a Super Admin can set assigned outlets.') }
  const { error } = await supabase.rpc('admin_set_staff_outlets', { target: id, outlet_ids: outletIds })
  if (error) return { error: /admin_set_staff_outlets/.test(error.message) ? t('담당 매체를 쓰려면 staff-outlets.sql을 실행해 주세요.', 'To use assigned outlets, run staff-outlets.sql.') : error.message }
  revalidatePath('/admin/users')
  return { ok: t('저장했습니다.', 'Saved.') }
}

// 회원 탈퇴(계정 삭제) — 총관리자만 (member-delete.sql). 쓴 기사는 기자명 그대로 남는다
export async function deleteMember(id: string): Promise<FormState> {
  const { supabase, isSuper, user, t } = await groupContext()
  if (!isSuper) return { error: t('회원 탈퇴는 총관리자만 할 수 있습니다.', 'Only a Super Admin can remove a member account.') }
  if (id === user.id) return { error: t('내 계정은 여기서 탈퇴시킬 수 없습니다.', 'You cannot remove your own account here.') }
  const { error } = await supabase.rpc('admin_delete_user', { target: id })
  if (error) return { error: /admin_delete_user/.test(error.message) ? t('회원 탈퇴를 쓰려면 member-delete.sql을 실행해 주세요.', 'To remove member accounts, run member-delete.sql.') : error.message }
  revalidatePath('/', 'layout')
  return { ok: t('탈퇴 처리했습니다.', 'Account removed.') }
}

// 출입 정지 · 해제 (퇴사자 등, account-security.sql). 발행인은 우리 그룹 기자·편집장, 총관리자는 모두 (DB가 확인한다)
//   정지하면 바로 편집국과 DB 자료를 못 연다. 쓴 기사는 기자명 그대로 남는다
export async function suspendMember(id: string, suspend: boolean): Promise<FormState> {
  const { supabase, t } = await groupContext()
  const { error } = await supabase.rpc('admin_suspend_user', { target: id, suspend })
  if (error) return { error: /admin_suspend_user/.test(error.message) ? t('출입 정지를 쓰려면 account-security.sql을 실행해 주세요.', 'To suspend access, run account-security.sql.') : error.message }
  revalidatePath('/admin/users')
  return { ok: suspend ? t('출입을 정지했습니다.', 'Access suspended.') : t('정지를 풀었습니다.', 'Suspension lifted.') }
}

// 2단계 인증 초기화 (휴대폰을 잃어버린 회원). 다음 로그인 때 인증 앱을 새로 등록한다
export async function resetMemberMfa(id: string): Promise<FormState> {
  const { supabase, t } = await groupContext()
  const { error } = await supabase.rpc('admin_reset_mfa', { target: id })
  if (error) return { error: /admin_reset_mfa/.test(error.message) ? t('2단계 인증을 쓰려면 account-security.sql을 실행해 주세요.', 'To use two-step verification, run account-security.sql.') : error.message }
  revalidatePath('/admin/users')
  return { ok: t('2단계 인증을 초기화했습니다.', 'Two-step verification has been reset.') }
}

// 모든 기기에서 로그아웃 (발행인은 우리 그룹 기자·편집장, 총관리자는 모두. DB가 한 번 더 확인)
export async function signOutMember(id: string): Promise<FormState> {
  const { supabase, t } = await groupContext()
  const { data, error } = await supabase.rpc('admin_signout_user', { target: id })
  if (error) return { error: /admin_signout_user/.test(error.message) ? t('원격 로그아웃을 쓰려면 login-security.sql을 실행해 주세요.', 'To sign people out remotely, run login-security.sql.') : error.message }
  revalidatePath('/admin/users')
  return { ok: Number(data) ? t(`${Number(data)}곳의 로그인을 끊었습니다.`, `Signed out ${Number(data)} ${Number(data) === 1 ? 'device' : 'devices'}.`) : t('로그인돼 있는 기기가 없었습니다.', 'There were no signed-in devices.') }
}

// 1년 이상 접속하지 않은 회원을 한 번에 출입 정지 (정지는 언제든 풀 수 있다)
export async function suspendDormant(ids: string[]): Promise<FormState> {
  const { supabase, t } = await groupContext()
  let done = 0
  const failed: string[] = []
  for (const id of ids.slice(0, 200)) {
    const { error } = await supabase.rpc('admin_suspend_user', { target: id, suspend: true })
    if (error) failed.push(error.message)
    else done++
  }
  revalidatePath('/admin/users')
  if (!done && failed.length) return { error: /admin_suspend_user/.test(failed[0]) ? t('출입 정지를 쓰려면 account-security.sql을 실행해 주세요.', 'To suspend access, run account-security.sql.') : failed[0] }
  return { ok: t(`${done}명을 출입 정지했습니다.${failed.length ? ` (${failed.length}명은 권한이 없어 건너뜀)` : ''}`, `Suspended access for ${done} ${done === 1 ? 'person' : 'people'}.${failed.length ? ` (${failed.length} skipped for lack of permission)` : ''}`) }
}
