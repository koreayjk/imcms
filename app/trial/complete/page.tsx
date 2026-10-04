import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isApproved } from '@/lib/cms'
import AuthShell from '@/components/auth/AuthShell'
import SignOutButton from '@/components/auth/SignOutButton'
import CompleteForm from './CompleteForm'

export const metadata: Metadata = { title: '체험 계정 만들기 | IM 뉴스룸', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

// 구글로 체험 가입: 구글에서 돌아오면 여기서 체험 계정으로 바꾼다 (trial-google.sql)
export default async function TrialCompletePage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/trial')
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  const trialUntil = (profile as { trial_until?: string | null } | null)?.trial_until ?? null
  if (trialUntil) redirect(Date.parse(trialUntil) > Date.now() ? '/newsroom' : '/trial/ended')

  if (isApproved(profile)) {
    return (
      <AuthShell subtitle="1주일 무료 체험">
        <div className="rounded-lg border border-line bg-white px-6 py-7 text-center">
          <p className="text-[15px] font-semibold">이미 편집국 회원인 계정입니다</p>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{user.email} 계정은 체험으로 바꿀 수 없습니다. 체험은 다른 구글 계정이나 이메일로 해 주세요.</p>
          <div className="mt-5 flex justify-center gap-2">
            <Link href="/newsroom" className="btn-primary">편집국으로</Link>
            <SignOutButton />
          </div>
        </div>
      </AuthShell>
    )
  }

  const meta = (user.user_metadata ?? {}) as { full_name?: string; name?: string }
  return (
    <AuthShell subtitle="1주일 무료 체험">
      <p className="mb-3 text-center text-[13.5px] text-muted"><b className="text-ink">{user.email}</b> 계정으로 체험을 시작합니다.</p>
      <CompleteForm defaultName={(profile?.full_name as string | undefined) || meta.full_name || meta.name || ''} />
    </AuthShell>
  )
}
