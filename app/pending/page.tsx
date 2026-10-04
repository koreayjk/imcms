import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isApproved } from '@/lib/cms'
import AuthShell from '@/components/auth/AuthShell'
import SignOutButton from '@/components/auth/SignOutButton'
import PendingButton from '@/components/cms/PendingButton'
import { changeRequestedOutlet } from './actions'

export const metadata = { title: '승인 대기 | IM CMS' }

export default async function PendingPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
  if (isApproved(profile)) redirect('/newsroom')

  // 신청한 소속 매체 (signup-outlet.sql 전이면 목록이 비어 고르기 칸을 숨긴다)
  const { data: outletRows, error: outletErr } = await supabase.rpc('signup_outlets')
  const outlets = outletErr ? [] : ((outletRows ?? []) as { id: string; name: string }[])
  const requested = (profile as { requested_outlet_id?: string | null } | null)?.requested_outlet_id ?? null
  const requestedName = outlets.find((o) => o.id === requested)?.name ?? null

  return (
    <AuthShell subtitle="가입 완료">
      <div className="rounded-lg border border-line bg-white px-6 py-7 text-center">
        <p className="text-[15px] font-semibold">관리자 승인을 기다리고 있습니다</p>
        <dl className="mx-auto mt-4 w-fit space-y-1 text-left text-sm">
          <div className="flex gap-3"><dt className="w-12 text-muted">이름</dt><dd>{profile?.full_name ?? '-'}</dd></div>
          <div className="flex gap-3"><dt className="w-12 text-muted">이메일</dt><dd>{user.email}</dd></div>
          {outlets.length > 0 && <div className="flex gap-3"><dt className="w-12 text-muted">매체</dt><dd>{requestedName ?? '정하지 않음'}</dd></div>}
        </dl>
        {outlets.length > 0 && (
          <form action={changeRequestedOutlet} className="mx-auto mt-4 flex max-w-xs gap-2">
            <label htmlFor="outlet" className="sr-only">소속 매체</label>
            <select id="outlet" name="outlet" defaultValue={requested ?? ''} className="field-input min-w-0 flex-1 py-1.5 text-[13px]">
              <option value="">목록에 없음 · 잘 모름</option>
              {outlets.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <PendingButton pending="…" className="btn-secondary shrink-0 px-3 py-1.5 text-[13px]">{requested ? '바꾸기' : '정하기'}</PendingButton>
          </form>
        )}
        <p className="mt-4 rounded bg-paper px-3 py-2.5 text-[13px] leading-relaxed text-muted">
          {requestedName
            ? <>{requestedName} 발행인이 승인하면 바로 기사를 쓸 수 있습니다. 승인 후 이 화면을 새로 고치세요.</>
            : <>소속 매체를 정하면 그 매체 발행인이, 정하지 않으면 IM 뉴스룸 관리자가 승인합니다. 승인 후 이 화면을 새로 고치세요.</>}
        </p>
        <p className="mt-3 text-[13px] text-muted">1주일 무료 체험을 하려던 거라면 <a href="/trial/complete" className="font-semibold text-ink underline underline-offset-2">체험 계정 만들기</a>로 이어서 하세요.</p>
        <div className="mt-5 flex justify-center gap-2">
          <a href="/newsroom" className="btn-primary">새로 고침</a>
          <SignOutButton />
        </div>
      </div>
    </AuthShell>
  )
}
