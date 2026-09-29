import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isApproved } from '@/lib/cms'
import AuthShell from '@/components/auth/AuthShell'
import SignOutButton from '@/components/auth/SignOutButton'

export const metadata = { title: '승인 대기 | IM CMS' }

export default async function PendingPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  if (isApproved(profile)) redirect('/newsroom')

  return (
    <AuthShell subtitle="가입 완료">
      <div className="rounded-lg border border-line bg-white px-6 py-7 text-center">
        <p className="text-[15px] font-semibold">관리자 승인을 기다리고 있습니다</p>
        <dl className="mx-auto mt-4 w-fit space-y-1 text-left text-sm">
          <div className="flex gap-3"><dt className="w-12 text-muted">이름</dt><dd>{profile?.full_name ?? '-'}</dd></div>
          <div className="flex gap-3"><dt className="w-12 text-muted">이메일</dt><dd>{user.email}</dd></div>
        </dl>
        <p className="mt-4 rounded bg-paper px-3 py-2.5 text-[13px] leading-relaxed text-muted">
          관리자가 소속 매체와 역할을 정해 승인하면 바로 기사를 쓸 수 있습니다. 승인 후 이 화면을 새로 고치세요.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <a href="/newsroom" className="btn-primary">새로 고침</a>
          <SignOutButton />
        </div>
      </div>
    </AuthShell>
  )
}
