import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { formatDateTime } from '@/lib/format'
import { ROLE_LABEL, type Profile, type UserRole } from '@/lib/types'
import UserManager, { InviteForm, type OutletOption } from '@/components/UserManager'
import PendingButton from '@/components/cms/PendingButton'
import { appointStaff, approveUser, cancelInvite, rejectUser, setStaff } from './actions'

type AuthInfo = { id: string; email: string; provider: string; last_sign_in_at: string | null }

export default async function UsersPage({ searchParams }: { searchParams: { error?: string } }) {
  const { supabase, user, isSuper, isGroupAdmin, outletId } = await getCmsContext()
  if (!isGroupAdmin) redirect('/articles')

  const [{ data: users }, outletsRes, { data: groups }, { data: authUsers, error: authError }, { data: invites }] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at'),
    supabase.from('outlets').select('id, name, publisher_id, publisher:publishers(name)').order('created_at'),
    supabase.from('publishers').select('id, name').order('created_at'),
    supabase.rpc('admin_list_users'),
    supabase.from('invitations').select('id, email, full_name, role, created_at, outlet:outlets(name)').is('accepted_at', null).order('created_at', { ascending: false }),
  ])
  if (outletsRes.error) {
    return (
      <div className="mx-auto max-w-[900px] px-4 py-10 md:px-8 md:py-16">
        <p className="rounded-lg border border-draft/40 bg-draft/10 px-5 py-4 text-sm">그룹별 회원 관리를 쓰려면 Supabase에서 <code>supabase/groups.sql</code>을 실행해 주세요.</p>
      </div>
    )
  }

  const outletRows = (outletsRes.data ?? []) as any[]
  const outlets: OutletOption[] = outletRows.map((o) => ({ id: o.id, name: o.name, group: o.publisher?.name ?? null }))
  const groupName = new Map((groups ?? []).map((g) => [g.id as string, g.name as string]))
  const outletGroup = new Map(outletRows.map((o) => [o.id as string, (o.publisher_id as string | null) ?? null]))
  const info = new Map(((authUsers ?? []) as AuthInfo[]).map((u) => [u.id, u]))

  const all = (users ?? []) as Profile[]
  const pending = all.filter((u) => u.approved === false && u.role !== 'admin' && !u.is_super)
  const members = all.filter((u) => !pending.includes(u))
  const groupIdOf = (u: Profile) => u.publisher_id ?? (u.outlet_id ? outletGroup.get(u.outlet_id) ?? null : null)
  const groupOf = Object.fromEntries(members.map((u) => [u.id, groupIdOf(u) ? groupName.get(groupIdOf(u)!) ?? null : null]))

  // 총관리자는 그룹별로 나눠 보고, 발행인은 자기 그룹만 본다
  const sections = isSuper
    ? [...(groups ?? []).map((g) => ({ key: g.id as string, title: g.name as string, list: members.filter((u) => groupIdOf(u) === g.id) })),
       { key: 'none', title: '그룹 없음 (총관리자 등)', list: members.filter((u) => !groupIdOf(u)) }].filter((s) => s.list.length)
    : [{ key: 'mine', title: '우리 그룹 회원', list: members }]

  return (
    <div className="mx-auto max-w-[1000px] space-y-8 px-4 py-5 md:px-8 md:py-8">
      <header>
        <h1 className="text-[22px] font-bold tracking-tight">회원 관리</h1>
        <p className="mt-1 text-[13px] text-muted">
          {isSuper ? '모든 그룹의 회원과 가입 신청을 관리합니다.' : '우리 그룹 회원의 역할과 매체를 정하고, 새 기자를 초대합니다.'}
          {' '}기자 = 자기 기사 · 편집장 = 자기 매체 · 발행인 = 그룹의 모든 매체
        </p>
      </header>

      {searchParams.error && <p role="alert" className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">{searchParams.error}</p>}
      {authError && <p className="rounded-lg border border-draft/40 bg-draft/10 px-4 py-3 text-sm">이메일을 보려면 <code>supabase/groups.sql</code>을 실행해 주세요.</p>}

      <InviteForm outlets={outlets} />

      {(invites ?? []).length > 0 && (
        <section>
          <h2 className="mb-2 text-[15px] font-bold">가입을 기다리는 초대</h2>
          <ul className="divide-y divide-line rounded-lg border border-line bg-white">
            {(invites ?? []).map((i: any) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13.5px]">
                <span className="font-semibold">{i.email}</span>
                <span className="text-muted">{i.full_name ?? ''} · {ROLE_LABEL[i.role as UserRole]} · {i.outlet?.name ?? ''} · {formatDateTime(i.created_at)}</span>
                <form action={cancelInvite.bind(null, i.id)} className="ml-auto">
                  <PendingButton pending="…" confirm="이 초대를 취소할까요?" className="text-[12.5px] text-muted underline underline-offset-2 hover:text-danger">취소</PendingButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(isSuper || pending.length > 0) && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-[15px] font-bold">
            가입 승인 대기
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
                      <p className="mt-0.5 text-[12.5px] text-muted">{a?.email ?? '이메일 확인 불가'} · {a?.provider === 'google' ? '구글 가입' : '이메일 가입'} · {formatDateTime(u.created_at)}</p>
                      <p className="mt-1 text-[12.5px]">
                        신청 매체:{' '}
                        {u.requested_outlet_id
                          ? <strong>{outlets.find((o) => o.id === u.requested_outlet_id)?.name ?? '다른 그룹 매체'}</strong>
                          : <span className="text-muted">정하지 않음</span>}
                      </p>
                    </div>
                    <form action={approveUser.bind(null, u.id)} className="flex items-center gap-2">
                      <select name="role" defaultValue="reporter" aria-label="역할" className="rounded border border-line px-2 py-1.5 text-[13px]">
                        <option value="reporter">기자</option><option value="editor">편집장</option><option value="admin">발행인</option>
                        {isSuper && <option value="staff">IM 뉴스룸 매니저</option>}
                      </select>
                      <select name="outlet_id" defaultValue={(u.requested_outlet_id && outlets.some((o) => o.id === u.requested_outlet_id) ? u.requested_outlet_id : outletId) ?? ''} aria-label="매체" className="rounded border border-line px-2 py-1.5 text-[13px]">
                        <option value="">매체 선택</option>
                        {outlets.map((o) => <option key={o.id} value={o.id}>{o.group ? `${o.group} · ` : ''}{o.name}</option>)}
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
            <p className="rounded-lg border border-line bg-white px-5 py-5 text-center text-sm text-muted">승인을 기다리는 가입 신청이 없습니다. 초대한 사람은 가입하면 바로 승인됩니다.</p>
          )}
        </section>
      )}

      {isSuper && (
        <section className="rounded-lg border border-[#2F6BF0]/30 bg-[#2F6BF0]/5 p-5">
          <h2 className="text-[15px] font-bold">IM 뉴스룸 매니저 <span className="text-[12.5px] font-normal text-muted">상담 신청·업무요청 처리, 공지, 고객사 개설, 대시보드·청구서 보기</span></h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {members.filter((u) => u.is_staff).map((u) => (
              <li key={u.id} className="flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-[13px] ring-1 ring-line">
                <strong>{u.full_name}</strong><span className="text-muted">{info.get(u.id)?.email}</span>
                <form action={setStaff.bind(null, u.id, false)}>
                  <PendingButton pending="…" confirm={`${u.full_name}님을 매니저에서 해제할까요?`} className="text-[12px] text-muted underline underline-offset-2 hover:text-danger">해제</PendingButton>
                </form>
              </li>
            ))}
            {!members.some((u) => u.is_staff) && <li className="text-[13px] text-muted">아직 매니저가 없습니다. 매니저가 가입하면 승인 대기에서 “IM 뉴스룸 매니저”로 승인하거나, 아래에서 지정하세요.</li>}
          </ul>
          <form action={appointStaff} className="mt-3 flex gap-2">
            <select name="user_id" defaultValue="" aria-label="매니저로 지정할 회원" className="rounded border border-line bg-white px-2 py-1.5 text-[13px]">
              <option value="">회원 선택</option>
              {members.filter((u) => !u.is_staff && !u.is_super).map((u) => <option key={u.id} value={u.id}>{u.full_name} {info.get(u.id)?.email ? `(${info.get(u.id)?.email})` : ''}</option>)}
            </select>
            <PendingButton pending="지정 중…" className="btn-secondary bg-white">매니저로 지정</PendingButton>
          </form>
        </section>
      )}

      {sections.map((s) => (
        <section key={s.key}>
          <h2 className="mb-2 text-[15px] font-bold">{s.title} <span className="text-[12.5px] font-normal text-muted">{s.list.length}명</span></h2>
          <UserManager users={s.list} outlets={outlets} currentUserId={user.id} emails={Object.fromEntries(Array.from(info, ([id, a]) => [id, a.email]))} groupOf={groupOf} />
        </section>
      ))}
    </div>
  )
}
