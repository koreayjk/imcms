import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import LoginHistory, { type LoginRow } from '@/components/cms/LoginHistory'
import { signOutMember } from '../../actions'
import BackLink from '@/components/cms/BackLink'

// 회원 한 명의 로그인 기록 (발행인은 우리 그룹 기자·편집장, 총관리자는 모두)
export default async function MemberLoginsPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const { supabase, isGroupAdmin, user, trial } = await getCmsContext()
  if (!isGroupAdmin || trial) redirect('/admin/users')
  if (id === user.id) redirect('/account')
  const { t, lang } = await getT()
  const [{ data: member }, { data, error }] = await Promise.all([
    supabase.from('profiles').select('full_name, suspended_at').eq('id', id).maybeSingle(),
    supabase.rpc('login_history', { target: id, lim: 50 }),
  ])
  const name = (member as { full_name?: string } | null)?.full_name ?? t('회원', 'Member')
  const missing = error && /login_history/.test(error.message)

  return (
    <div className="mx-auto max-w-[860px] space-y-5 px-4 py-5 md:px-8 md:py-8">
      <BackLink href="/admin/users" className="text-[13px] text-muted hover:text-ink">{t('← 회원 관리', '← Members')}</BackLink>
      <header>
        <h1 className="text-[22px] font-bold tracking-tight">{t(`${name}님의 로그인 기록`, `Login history for ${name}`)}</h1>
        <p className="mt-1 text-[13px] text-muted">
          {t('최근 50번의 로그인(기기·브라우저마다 한 번)과 지금도 로그인돼 있는지 보여줍니다. 기록은 1년 동안 보관합니다.', 'Shows the last 50 logins (one per device and browser) and whether they are still signed in. Records are kept for one year.')}
          {(member as { suspended_at?: string | null } | null)?.suspended_at && <strong className="text-danger"> {t('지금 출입 정지된 회원입니다.', 'This member\'s access is currently suspended.')}</strong>}
        </p>
      </header>
      {error ? (
        <p className="rounded-lg border border-draft/40 bg-draft/10 px-4 py-3 text-sm">
          {missing ? (lang === 'en' ? <>To see login history, run <code>supabase/login-security.sql</code> in Supabase.</> : <>로그인 기록을 보려면 Supabase에서 <code>supabase/login-security.sql</code>을 실행해 주세요.</>) : error.message}
        </p>
      ) : (
        <div className="rounded-lg border border-line bg-white p-5">
          <LoginHistory rows={(data ?? []) as LoginRow[]} self={false} name={name} signOut={signOutMember.bind(null, id)} />
        </div>
      )}
    </div>
  )
}
