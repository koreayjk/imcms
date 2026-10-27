import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isApproved } from '@/lib/cms'
import AuthShell from '@/components/auth/AuthShell'
import SignOutButton from '@/components/auth/SignOutButton'
import PendingButton from '@/components/cms/PendingButton'
import { changeRequestedOutlet } from './actions'
import { BRAND_ICONS } from '@/lib/brand'
import { getPublicT } from '@/lib/cms-t-public'

export async function generateMetadata() {
  const { t } = await getPublicT()
  return { title: t('승인 대기 | IM 뉴스룸', 'Awaiting approval | IM Newsroom'), icons: BRAND_ICONS }
}

export default async function PendingPage() {
  const { t, lang } = await getPublicT()
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 출입 정지된 계정 (account-security.sql): 자기 회원 정보도 못 읽으므로 따로 묻는다
  const { data: suspended } = await supabase.rpc('am_i_suspended')
  if (suspended === true) {
    return (
      <AuthShell lang={lang} subtitle={t('편집국 출입 정지', 'Newsroom access suspended')}>
        <div className="rounded-lg border border-line bg-white px-6 py-7 text-center">
          <p className="text-[15px] font-semibold">{t('이 계정은 편집국 출입이 정지되었습니다', 'Newsroom access for this account has been suspended')}</p>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            {user.email}<br />
            {t('발행인이 출입을 정지해 기사와 편집국 자료를 열 수 없습니다. 다시 쓰려면 소속 언론사 발행인에게 문의해 주세요.', 'The publisher has suspended your access, so you cannot open stories or newsroom materials. To regain access, please contact your outlet’s publisher.')}
          </p>
          <div className="mt-5 flex justify-center"><SignOutButton /></div>
        </div>
      </AuthShell>
    )
  }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  if (isApproved(profile)) redirect('/newsroom')

  // 신청한 소속 매체 (signup-outlet.sql 전이면 목록이 비어 고르기 칸을 숨긴다)
  const { data: outletRows, error: outletErr } = await supabase.rpc('signup_outlets')
  const outlets = outletErr ? [] : ((outletRows ?? []) as { id: string; name: string }[])
  const requested = (profile as { requested_outlet_id?: string | null } | null)?.requested_outlet_id ?? null
  const requestedName = outlets.find((o) => o.id === requested)?.name ?? null

  return (
    <AuthShell lang={lang} subtitle={t('가입 완료', 'Sign-up complete')}>
      <div className="rounded-lg border border-line bg-white px-6 py-7 text-center">
        <p className="text-[15px] font-semibold">{t('관리자 승인을 기다리고 있습니다', 'Waiting for administrator approval')}</p>
        <dl className="mx-auto mt-4 w-fit space-y-1 text-left text-sm">
          <div className="flex gap-3"><dt className="w-12 text-muted">{t('이름', 'Name')}</dt><dd>{profile?.full_name ?? '-'}</dd></div>
          <div className="flex gap-3"><dt className="w-12 text-muted">{t('이메일', 'Email')}</dt><dd>{user.email}</dd></div>
          {outlets.length > 0 && <div className="flex gap-3"><dt className="w-12 text-muted">{t('매체', 'Outlet')}</dt><dd>{requestedName ?? t('정하지 않음', 'Not chosen')}</dd></div>}
        </dl>
        {outlets.length > 0 && (
          <form action={changeRequestedOutlet} className="mx-auto mt-4 flex max-w-xs gap-2">
            <label htmlFor="outlet" className="sr-only">{t('소속 매체', 'Outlet')}</label>
            <select id="outlet" name="outlet" defaultValue={requested ?? ''} className="field-input min-w-0 flex-1 py-1.5 text-[13px]">
              <option value="">{t('목록에 없음 · 잘 모름', 'Not listed · Not sure')}</option>
              {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <PendingButton pending="…" className="btn-secondary shrink-0 px-3 py-1.5 text-[13px]">{requested ? t('바꾸기', 'Change') : t('정하기', 'Set')}</PendingButton>
          </form>
        )}
        <p className="mt-4 rounded bg-paper px-3 py-2.5 text-[13px] leading-relaxed text-muted">
          {requestedName
            ? <>{t(`${requestedName} 발행인이 승인하면 바로 기사를 쓸 수 있습니다. 승인 후 이 화면을 새로 고치세요.`, `You can start writing stories as soon as the publisher of ${requestedName} approves your account. Refresh this page after approval.`)}</>
            : <>{t('소속 매체를 정하면 그 매체 발행인이, 정하지 않으면 IM 뉴스룸 관리자가 승인합니다. 승인 후 이 화면을 새로 고치세요.', 'If you choose an outlet, its publisher approves your account; otherwise the IM Newsroom administrator does. Refresh this page after approval.')}</>}
        </p>
        <p className="ios-app-hide mt-3 text-[13px] text-muted">{lang === 'en' ? <>If you meant to start the 1-week free trial, continue with <a href="/trial/complete" className="font-semibold text-ink underline underline-offset-2">Create trial account</a>.</> : <>1주일 무료 체험을 하려던 거라면 <a href="/trial/complete" className="font-semibold text-ink underline underline-offset-2">체험 계정 만들기</a>로 이어서 하세요.</>}</p>
        <div className="mt-5 flex justify-center gap-2">
          <a href="/newsroom" className="btn-primary">{t('새로 고침', 'Refresh')}</a>
          <SignOutButton />
        </div>
      </div>
    </AuthShell>
  )
}
