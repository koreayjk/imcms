import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import LoginHistory, { type LoginRow } from '@/components/cms/LoginHistory'
import { signOutMember } from '../../actions'

// 회원 한 명의 로그인 기록 (발행인은 우리 그룹 기자·편집장, 총관리자는 모두)
export default async function MemberLoginsPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const { supabase, isGroupAdmin, user, trial } = await getCmsContext()
  if (!isGroupAdmin || trial) redirect('/admin/users')
  if (id === user.id) redirect('/account')
  const [{ data: member }, { data, error }] = await Promise.all([
    supabase.from('profiles').select('full_name, suspended_at').eq('id', id).maybeSingle(),
    supabase.rpc('login_history', { target: id, lim: 50 }),
  ])
  const name = (member as { full_name?: string } | null)?.full_name ?? '회원'
  const missing = error && /login_history/.test(error.message)

  return (
    <div className="mx-auto max-w-[860px] space-y-5 px-4 py-5 md:px-8 md:py-8">
      <Link href="/admin/users" className="text-[13px] text-muted hover:text-ink">← 회원 관리</Link>
      <header>
        <h1 className="text-[22px] font-bold tracking-tight">{name}님의 로그인 기록</h1>
        <p className="mt-1 text-[13px] text-muted">
          최근 50번의 로그인(기기·브라우저마다 한 번)과 지금도 로그인돼 있는지 보여줍니다. 기록은 1년 동안 보관합니다.
          {(member as { suspended_at?: string | null } | null)?.suspended_at && <strong className="text-danger"> 지금 출입 정지된 회원입니다.</strong>}
        </p>
      </header>
      {error ? (
        <p className="rounded-lg border border-draft/40 bg-draft/10 px-4 py-3 text-sm">
          {missing ? <>로그인 기록을 보려면 Supabase에서 <code>supabase/login-security.sql</code>을 실행해 주세요.</> : error.message}
        </p>
      ) : (
        <div className="rounded-lg border border-line bg-white p-5">
          <LoginHistory rows={(data ?? []) as LoginRow[]} self={false} name={name} signOut={signOutMember.bind(null, id)} />
        </div>
      )}
    </div>
  )
}
