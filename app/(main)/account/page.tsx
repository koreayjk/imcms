import { getCmsContext } from '@/lib/cms'
import { ROLE_LABEL, type UserRole } from '@/lib/types'
import NameForm from '@/components/cms/NameForm'
import EmailNotifyToggle from '@/components/cms/EmailNotifyToggle'

export default async function AccountPage() {
  const { supabase, user, profile, outletId } = await getCmsContext()
  const { data: outlet } = outletId ? await supabase.from('outlets').select('name').eq('id', outletId).single() : { data: null }

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
        <p className="border-t border-line pt-5 text-[12.5px] leading-relaxed text-muted">
          이름을 바꾸면 기자명을 따로 적지 않은 기사는 홈페이지 기자 이름도 함께 바뀝니다.
          이미 쓴 기사 본문 첫머리의 “[매체=이름 기자]”는 그대로이니, 필요하면 기사 수정에서 기자명을 다시 저장해 주세요.
          역할과 소속은 관리자가 정합니다.
        </p>
      </div>
    </div>
  )
}
