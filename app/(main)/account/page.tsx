import { getCmsContext } from '@/lib/cms'
import { ROLE_LABEL, type UserRole } from '@/lib/types'
import NameForm from '@/components/cms/NameForm'
import LanguageForm from '@/components/cms/LanguageForm'
import EmailNotifyToggle from '@/components/cms/EmailNotifyToggle'
import MfaSettings from '@/components/cms/MfaSettings'
import LoginHistory, { type LoginRow } from '@/components/cms/LoginHistory'
import { signOutOtherDevices } from './actions'
import DeleteAccountRequest from '@/components/cms/DeleteAccountRequest'
import { PolicyLinks } from '@/components/auth/AuthShell'

export default async function AccountPage() {
  const { supabase, user, profile, outletId, isGroupAdmin, isSuper, publisherId, trial } = await getCmsContext()
  const { data: outlet } = outletId ? await supabase.from('outlets').select('name, site').eq('id', outletId).single() : { data: null }
  // 2단계 인증 (account-security.sql 전이면 필수 여부·그룹 설정은 숨긴다)
  const factors = (user.factors ?? []).filter((f) => f.status === 'verified' && f.factor_type === 'totp')
    .map((f) => ({ id: f.id, name: f.friendly_name || '인증 앱', createdAt: f.created_at }))
  const [{ data: required }, historyRes, groupRes] = await Promise.all([
    supabase.rpc('my_mfa_required'),
    // 로그인 기록 (login-security.sql 전이면 오류 → 칸을 숨긴다)
    trial ? Promise.resolve({ data: null, error: true }) : supabase.rpc('login_history', { target: user.id, lim: 15 }),
    isGroupAdmin && !isSuper && publisherId ? supabase.from('publishers').select('name, require_mfa').eq('id', publisherId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])
  const g = groupRes.data as { name: string | null; require_mfa?: boolean } | null
  const group = g && !groupRes.error && 'require_mfa' in g ? { name: g.name, on: !!g.require_mfa } : null

  return (
    <div className="mx-auto max-w-[720px] px-4 py-5 md:px-8 md:py-8">
      <h1 className="mb-6 text-[22px] font-bold tracking-tight">내 정보</h1>
      <div className="space-y-6 rounded-lg border border-line bg-white p-4 sm:p-7">
        <NameForm name={profile?.full_name ?? ''} />
        <LanguageForm value={(profile as { cms_lang?: string | null } | null)?.cms_lang === 'en' ? 'en' : (profile as { cms_lang?: string | null } | null)?.cms_lang === 'ko' ? 'ko' : null} outletDefault={(outlet?.site as { cmsLang?: string } | null)?.cmsLang === 'en' ? 'en' : 'ko'} />
        <dl className="grid grid-cols-[80px_1fr] gap-y-2.5 border-t border-line pt-5 text-[13.5px]">
          <dt className="text-muted">이메일</dt><dd className="min-w-0 break-all">{user.email}</dd>
          <dt className="text-muted">역할</dt><dd>{profile?.role ? ROLE_LABEL[profile.role as UserRole] : '-'}</dd>
          <dt className="text-muted">소속</dt><dd>{outlet?.name ?? '미배정'}</dd>
        </dl>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <div>
            <h2 className="text-[15px] font-bold">비밀번호</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">새 비밀번호를 정하거나 바꿉니다. 구글로 가입했어도 비밀번호를 정하면 아이폰 앱에서 이메일로 로그인할 수 있습니다.</p>
          </div>
          <a href="/login/reset" className="whitespace-nowrap rounded-full border border-line px-4 py-2 text-[13px] font-semibold hover:border-ink">비밀번호 정하기·바꾸기</a>
        </div>
        <EmailNotifyToggle initial={(profile as { email_notify?: boolean } | null)?.email_notify !== false} />
        {!trial && <MfaSettings factors={factors} required={required === true} group={group} />}
        {!historyRes.error && (
          <section className="space-y-3 border-t border-line pt-5">
            <div>
              <h2 className="text-[15px] font-bold">로그인 기록</h2>
              <p className="mt-0.5 text-[12.5px] text-muted">
                최근 로그인한 기기와 IP입니다(1년 보관). 모르는 기기가 보이면 <strong>다른 기기 모두 로그아웃</strong>을 누르고 비밀번호를 바꾸세요.
                PC방·남의 컴퓨터에서 로그아웃을 잊었을 때도 여기서 끊을 수 있습니다.
              </p>
            </div>
            <LoginHistory rows={(historyRes.data ?? []) as LoginRow[]} self signOut={signOutOtherDevices} />
          </section>
        )}
        <p className="border-t border-line pt-5 text-[12.5px] leading-relaxed text-muted">
          이름을 바꾸면 기자명을 따로 적지 않은 기사는 홈페이지 기자 이름도 함께 바뀝니다.
          이미 쓴 기사 본문 첫머리의 “[매체=이름 기자]”는 그대로이니, 필요하면 기사 수정에서 기자명을 다시 저장해 주세요.
          역할과 소속은 관리자가 정합니다.
        </p>
        {!isSuper && <DeleteAccountRequest manager={profile?.role === 'editor' || profile?.role === 'admin'} />}
        <PolicyLinks className="border-t border-line pt-5" />
      </div>
    </div>
  )
}
