'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { STAFF_OUTLET_COOKIE, getCmsContext } from '@/lib/cms'

export type NameState = { ok?: boolean; error?: string }

export async function updateMyName(_prev: NameState, form: FormData): Promise<NameState> {
  const { supabase, user } = await getCmsContext()
  const name = String(form.get('full_name') ?? '').trim().replace(/\s+/g, ' ')
  if (!name) return { error: '이름을 적어주세요.' }
  if (name.length > 30) return { error: '이름은 30자까지 쓸 수 있습니다.' }

  const { error } = await supabase.from('profiles').update({ full_name: name }).eq('id', user.id)
  if (error) return { error: `바꾸지 못했습니다: ${error.message}` }
  revalidatePath('/', 'layout')
  return { ok: true }
}

// 내 편집국 언어 (비우면 매체 기본 언어를 따른다, cms-lang.sql)
export async function setMyLang(value: 'default' | 'ko' | 'en'): Promise<{ error?: string }> {
  const { supabase, user, lang } = await getCmsContext()
  const en = lang === 'en'
  const cms_lang = value === 'ko' || value === 'en' ? value : null
  const { error } = await supabase.from('profiles').update({ cms_lang }).eq('id', user.id)
  if (error) return { error: /cms_lang|column/i.test(error.message) ? (en ? 'The operations team needs to run supabase/cms-lang.sql first.' : '운영팀이 Supabase에서 cms-lang.sql을 먼저 실행해야 합니다.') : (en ? `Could not change it: ${error.message}` : `바꾸지 못했습니다: ${error.message}`) }
  revalidatePath('/', 'layout')
  return {}
}

// 발행인·총관리자: 작업할 매체 바꾸기 (DB가 자기 그룹 매체인지 확인한다)
export async function switchOutlet(outletId: string): Promise<{ error?: string }> {
  const { supabase, user, isGroupAdmin, isStaff, isSuper } = await getCmsContext()
  // 매니저: 소속을 바꾸지 않고 작업할 매체만 기억한다 (섹션·홈 편집판·광고·홈페이지 설정)
  if (isStaff && !isSuper) {
    const { data: o } = await supabase.from('outlets').select('id').eq('id', outletId).maybeSingle()
    if (!o) return { error: '매체를 찾지 못했습니다.' }
    const jar = await cookies()
    jar.set(STAFF_OUTLET_COOKIE, outletId, { path: '/', httpOnly: true, sameSite: 'lax', secure: true, maxAge: 60 * 60 * 24 * 30 })
    revalidatePath('/', 'layout')
    return {}
  }
  // 기자·편집장: 소속된 매체로만, 그 매체의 직급으로 바뀐다 (DB 함수가 확인)
  if (!isGroupAdmin) {
    const { error } = await supabase.rpc('switch_my_outlet', { o: outletId })
    if (error) return { error: /switch_my_outlet/.test(error.message) ? '매체를 바꿀 권한이 없습니다.' : error.message }
    revalidatePath('/', 'layout')
    return {}
  }
  const { error } = await supabase.from('profiles').update({ outlet_id: outletId }).eq('id', user.id)
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return {}
}

// 알림 메일 받기 켜기·끄기 (승인신청·반려·업무요청 답변 등). mail.sql 실행 전이면 칸이 없어 실패한다
export async function setEmailNotify(on: boolean): Promise<{ error?: string }> {
  const { supabase, user } = await getCmsContext()
  const { error } = await supabase.from('profiles').update({ email_notify: on }).eq('id', user.id)
  if (error) return { error: /email_notify/.test(error.message) ? '알림 메일 설정은 준비 중입니다.' : error.message }
  revalidatePath('/account')
  return {}
}

// 발행인: 우리 그룹 발행인·편집장 2단계 인증 필수 (account-security.sql)
export async function setGroupRequireMfa(on: boolean): Promise<{ error?: string }> {
  const { supabase, isGroupAdmin } = await getCmsContext()
  if (!isGroupAdmin) return { error: '발행인만 바꿀 수 있습니다.' }
  const { error } = await supabase.rpc('set_group_require_mfa', { on_off: on })
  if (error) return { error: /set_group_require_mfa/.test(error.message) ? '2단계 인증 설정을 쓰려면 account-security.sql을 실행해 주세요.' : error.message }
  revalidatePath('/account')
  return {}
}

// 다른 기기 모두 로그아웃: 지금 이 기기만 남기고 내 다른 로그인을 끊는다 (login-security.sql 전이면 Supabase 기본 기능으로)
export async function signOutOtherDevices(): Promise<{ error?: string; ok?: string }> {
  const { supabase, user } = await getCmsContext()
  const { data, error } = await supabase.rpc('admin_signout_user', { target: user.id })
  if (error) {
    if (!/admin_signout_user/.test(error.message)) return { error: `끊지 못했습니다: ${error.message}` }
    const { error: err } = await supabase.auth.signOut({ scope: 'others' })
    if (err) return { error: `끊지 못했습니다: ${err.message}` }
    return { ok: '다른 기기의 로그인을 모두 끊었습니다.' }
  }
  revalidatePath('/account')
  return { ok: Number(data) ? `다른 기기 ${Number(data)}곳의 로그인을 끊었습니다.` : '끊을 다른 기기 로그인이 없었습니다.' }
}

// 계정 삭제 요청 (구글 플레이 정책: 앱 안에서 계정 삭제를 요청할 수 있어야 한다)
//   고객센터에 '계정 삭제 요청'을 남기고, 운영팀(총관리자)이 회원 관리에서 탈퇴 처리한다. AI 답변은 달지 않는다
const DELETE_REQUEST_TITLE = '계정 삭제 요청'
export async function requestAccountDeletion(reason: string): Promise<{ id?: string; error?: string }> {
  const { supabase, user, outletId, profile } = await getCmsContext()
  const { data: open } = await supabase.from('support_tickets').select('id')
    .eq('requester_id', user.id).eq('title', DELETE_REQUEST_TITLE).neq('status', 'done').limit(1).maybeSingle()
  if (open) return { id: (open as { id: string }).id }
  const body = [
    '편집국 "내 정보"에서 계정 삭제를 요청했습니다.',
    `이름: ${profile?.full_name ?? '-'}`,
    `이메일: ${user.email ?? '-'}`,
    reason.trim() ? `사유: ${reason.trim().slice(0, 1000)}` : '',
    '',
    '운영팀 처리: 회원 관리 → 이 회원 → 관리 ⋯ → 탈퇴. 쓴 기사는 기자명과 함께 매체에 남습니다.',
  ].filter((l, i, a) => l || a[i - 1]).join('\n')
  const { data, error } = await supabase.from('support_tickets')
    .insert({ category: 'etc', title: DELETE_REQUEST_TITLE, body, requester_id: user.id, outlet_id: outletId }).select('id').single()
  if (error || !data) return { error: `요청을 저장하지 못했습니다: ${error?.message ?? ''}` }
  revalidatePath('/support', 'layout')
  return { id: (data as { id: string }).id }
}

// 내 계정 바로 삭제 (애플 앱 심사: 앱 안에서 계정을 바로 지울 수 있어야 한다, self-delete.sql)
//   언론사·그룹·매체와 쓴 기사(기자명 포함)는 남는다. 지우고 나면 로그아웃된다
export async function deleteMyAccount(confirmText: string): Promise<{ ok?: boolean; error?: string }> {
  const { supabase, isSuper } = await getCmsContext()
  if (isSuper) return { error: '총관리자 계정은 여기서 지울 수 없습니다.' }
  if (confirmText.trim() !== '삭제') return { error: '확인 칸에 “삭제”라고 적어 주세요.' }
  const { error } = await supabase.rpc('delete_my_account')
  if (error) return { error: /delete_my_account/.test(error.message) ? '지금은 바로 삭제할 수 없습니다. 고객센터로 계정 삭제를 요청해 주세요. (운영팀: self-delete.sql 실행 필요)' : error.message }
  await supabase.auth.signOut().catch(() => {})
  return { ok: true }
}

