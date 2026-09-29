import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { formatDateTime } from '@/lib/format'
import { ROLE_LABEL, type Profile, type UserRole } from '@/lib/types'
import UserManager from '@/components/UserManager'
import PendingButton from '@/components/cms/PendingButton'
import { approveUser, rejectUser } from './actions'

type AuthInfo = { id: string; email: string; provider: string; last_sign_in_at: string | null }

export default async function UsersPage({ searchParams }: { searchParams: { error?: string } }) {
  const { supabase, user, profile, outletId } = await getCmsContext()
  if (profile?.role !== 'admin') redirect('/articles')

  const [{ data: users }, { data: outlets }, { data: authUsers, error: authError }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at'),
    supabase.from('outlets').select('id, name').order('created_at'),
    supabase.rpc('admin_list_users'),
  ])
  const info = new Map(((authUsers ?? []) as AuthInfo[]).map((u) => [u.id, u]))
  const all = (users ?? []) as Profile[]
  const pending = all.filter((u) => u.approved === false && u.role !== 'admin')
  const members = all.filter((u) => !pending.includes(u))

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <header className="mb-6">
        <h1 className="text-lg font-semibold">회원 관리</h1>
        <p className="mt-0.5 text-sm text-muted">가입 신청을 승인하고, 기자·편집장·관리자 역할과 소속 매체를 설정합니다</p>
      </header>

      {searchParams.error && (
        <p role="alert" className="mb-5 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{searchParams.error}</p>
      )}
      {authError && (
        <p className="mb-5 rounded-lg border border-draft/40 bg-draft/10 px-4 py-3 text-sm">
          가입 승인 기능을 쓰려면 Supabase에서 <code>supabase/signup.sql</code>을 실행해 주세요.
        </p>
      )}

      <section className="mb-10">
        <h2 className="mb-3 flex items-center gap-2 text-[15px] font-bold">
          승인 대기
          <span className={`rounded-full px-2 text-[12px] tabular-nums ${pending.length ? 'bg-danger text-white' : 'bg-line text-muted'}`}>{pending.length}</span>
        </h2>
        {pending.length ? (
          <ul className="divide-y divide-line rounded-lg border border-line bg-white">
            {pending.map((u) => {
              const a = info.get(u.id)
              return (
                <li key={u.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
                  <div className="min-w-[200px] flex-1">
                    <p className="font-semibold">{u.full_name}</p>
                    <p className="mt-0.5 text-[12.5px] text-muted">
                      {a?.email ?? '이메일 확인 불가'} · {a?.provider === 'google' ? '구글 가입' : '이메일 가입'} · {formatDateTime(u.created_at)}
                    </p>
                  </div>
                  <form action={approveUser.bind(null, u.id)} className="flex items-center gap-2">
                    <label className="sr-only" htmlFor={`role-${u.id}`}>역할</label>
                    <select id={`role-${u.id}`} name="role" defaultValue="reporter" className="rounded border border-line px-2 py-1.5 text-[13px]">
                      {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                    <label className="sr-only" htmlFor={`outlet-${u.id}`}>소속 매체</label>
                    <select id={`outlet-${u.id}`} name="outlet_id" defaultValue={outletId ?? ''} className="rounded border border-line px-2 py-1.5 text-[13px]">
                      <option value="">소속 선택</option>
                      {(outlets ?? []).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                    </select>
                    <PendingButton pending="승인 중…" className="btn-publish px-3 py-1.5 text-[13px]">승인</PendingButton>
                  </form>
                  <form action={rejectUser.bind(null, u.id)}>
                    <PendingButton pending="거절 중…" confirm={`${u.full_name}님의 가입을 거절하고 계정을 삭제할까요?`} className="btn-secondary px-3 py-1.5 text-[13px] text-danger">거절</PendingButton>
                  </form>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="rounded-lg border border-line bg-white px-5 py-6 text-center text-sm text-muted">승인을 기다리는 가입 신청이 없습니다.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-[15px] font-bold">편집국 회원</h2>
        <UserManager
          users={members}
          outlets={outlets ?? []}
          currentUserId={user.id}
          emails={Object.fromEntries(Array.from(info, ([id, a]) => [id, a.email]))}
        />
      </section>
    </div>
  )
}
