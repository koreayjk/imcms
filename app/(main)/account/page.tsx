import { getCmsContext } from '@/lib/cms'
import { ROLE_LABEL, type UserRole } from '@/lib/types'
import NameForm from '@/components/cms/NameForm'
import EmailNotifyToggle from '@/components/cms/EmailNotifyToggle'
import MfaSettings from '@/components/cms/MfaSettings'

export default async function AccountPage() {
  const { supabase, user, profile, outletId, isGroupAdmin, isSuper, publisherId, trial } = await getCmsContext()
  const { data: outlet } = outletId ? await supabase.from('outlets').select('name').eq('id', outletId).single() : { data: null }
  // 2단계 인증 (account-security.sql 전이면 필수 여부·그룹 설정은 숨긴다)
  const factors = (user.factors ?? []).filter((f) => f.status === 'verified' && f.factor_type === 'totp')
    .map((f) => ({ id: f.id, name: f.friendly_name || '인증 앱', createdAt: f.created_at }))
  const [{ data: required }, groupRes] = await Promise.all([
    supabase.rpc('my_mfa_required'),
    isGroupAdmin && !isSuper && publisherId ? supabase.from('publishers').select('name, require_mfa').eq('id', publisherId).maybeSingle() : Promise.resolve({ data: null, error: null }),
  ])
  const g = groupRes.data as { name: string | null; require_mfa?: boolean } | null
  const group = g && !groupRes.error && 'require_mfa' in g ? { name: g.name, on: !!g.require_mfa } : null

  return (
    <div className="mx-auto max-w-[720px] px-4 py-5 md:px-8 md:py-8">
      <h1 className="mb-6 text-[22px] font-bold tracking-tight">내 정보</h1>
      <div className="space-y-6 rounded-lg border border-line bg-white p-7">
        <NameForm name={profile?.full_name ?? ''} />
        <dl className="grid grid-cols-[80px_1fr] gap-y-2.5 border-t border-line pt-5 text-[13.5px]">
          <dt className="text-muted">이메일</dt><dd>{user.email}</dd>
          <dt className="text-muted">역할</dt><dd>{profile?.role ? ROLE_LABEL[profile.role as UserRole] : '-'}</dd>
          <dt className="text-muted">소속</dt><dd>{outlet?.name ?? '미배정'}</dd>
        </dl>
        <EmailNotifyToggle initial={(profile as { email_notify?: boolean } | null)?.email_notify !== false} />
        {!trial && <MfaSettings factors={factors} required={required === true} group={group} />}
        <p className="border-t border-line pt-5 text-[12.5px] leading-relaxed text-muted">
          이름을 바꾸면 기자명을 따로 적지 않은 기사는 홈페이지 기자 이름도 함께 바뀝니다.
          이미 쓴 기사 본문 첫머리의 “[매체=이름 기자]”는 그대로이니, 필요하면 기사 수정에서 기자명을 다시 저장해 주세요.
          역할과 소속은 관리자가 정합니다.
        </p>
      </div>
    </div>
  )
}
