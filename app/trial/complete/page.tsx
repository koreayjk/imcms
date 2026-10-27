import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isApproved } from '@/lib/cms'
import AuthShell from '@/components/auth/AuthShell'
import SignOutButton from '@/components/auth/SignOutButton'
import CompleteForm from './CompleteForm'
import { getPublicT } from '@/lib/cms-t-public'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getPublicT()
  return { title: t('체험 계정 만들기 | IM 뉴스룸', 'Create trial account | IM Newsroom'), robots: { index: false, follow: false } }
}
export const dynamic = 'force-dynamic'

// 구글로 체험 가입: 구글에서 돌아오면 여기서 체험 계정으로 바꾼다 (trial-google.sql)
export default async function TrialCompletePage() {
  const { t, lang } = await getPublicT()
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/trial')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  const trialUntil = (profile as { trial_until?: string | null } | null)?.trial_until ?? null
  if (trialUntil) redirect(Date.parse(trialUntil) > Date.now() ? '/newsroom' : '/trial/ended')

  if (isApproved(profile)) {
    return (
      <AuthShell lang={lang} subtitle={t('1주일 무료 체험', '1-week free trial')}>
        <div className="rounded-lg border border-line bg-white px-6 py-7 text-center">
          <p className="text-[15px] font-semibold">{t('이미 편집국 회원인 계정입니다', 'This account is already a newsroom member')}</p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{t(`${user.email} 계정은 체험으로 바꿀 수 없습니다. 체험은 다른 구글 계정이나 이메일로 해 주세요.`, `The account ${user.email} cannot be converted to a trial. Please use a different Google account or email for the trial.`)}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Link href="/newsroom" className="btn-primary">{t('편집국으로', 'Go to the newsroom')}</Link>
            <SignOutButton />
          </div>
        </div>
      </AuthShell>
    )
  }

  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string }
  return (
    <AuthShell lang={lang} subtitle={t('1주일 무료 체험', '1-week free trial')}>
      <p className="mb-3 text-center text-[13.5px] text-muted">{lang === 'en' ? <>Starting your trial with the account <b className="text-ink">{user.email}</b>.</> : <><b className="text-ink">{user.email}</b> 계정으로 체험을 시작합니다.</>}</p>
      <CompleteForm defaultName={(profile?.full_name as string | undefined) || meta.full_name || meta.name || ''} />
    </AuthShell>
  )
}
