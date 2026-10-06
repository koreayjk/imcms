import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { formatDateTime } from '@/lib/format'
import { ROLE_LABEL, type Profile, type UserRole } from '@/lib/types'
import UserManager, { InviteForm, type OutletOption } from '@/components/UserManager'
import PendingButton from '@/components/cms/PendingButton'
import StaffRow from '@/components/cms/StaffOutlets'
import { appointStaff, approveUser, cancelInvite, rejectUser } from './actions'

type AuthInfo = { id: string; email: string; provider: string; last_sign_in_at: string | null }

export default async function UsersPage(props: { searchParams: Promise<{ error?: string }> }) {
  const searchParams = await props.searchParams
  const { supabase, user, isSuper, isGroupAdmin, outletId, trial, profile } = await getCmsContext()
  if (!isGroupAdmin) redirect('/articles')
  // 체험 그룹장: 다른 체험자의 정보는 보여주지 않고, 이 화면에서 하는 일만 안내한다
  if (trial) {
    return (
      <div className="mx-auto max-w-[860px] px-4 py-6 md:px-8 md:py-10">
        <h1 className="text-[22px] font-extrabold tracking-tight">회원 관리</h1>
        <div className="mt-5 rounded-lg border border-[#1F3A5F]/25 bg-[#EEF3F9] px-5 py-4 text-[14px] leading-[1.75] text-[#1F3A5F]">
          <p className="font-bold">체험 중에는 회원 관리 화면을 미리 보기만 할 수 있어요.</p>
          <p className="mt-1">다른 체험자의 정보를 보호하려고 목록에는 내 계정만 보입니다.</p>
        </div>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {[
            ['가입 승인', '우리 매체로 가입 신청한 기자를 확인하고 승인하거나 거절합니다.'],
            ['기자 초대', '이메일로 기자를 초대하면 가입과 동시에 우리 매체 소속이 됩니다.'],
            ['역할 지정', '기자 · 편집장을 정하고, 매체마다 다른 역할을 줄 수 있습니다.'],
            ['기자별 AI 한도', '기자마다 한 달 AI 사용 횟수를 정해 비용을 관리합니다.'],
          ].map(([t, d]) => (
            <li key={t} className="rounded-lg border border-line bg-white p-4">
              <p className="font-bold">{t}</p>
              <p className="mt-1 text-[13px] leading-[1.7] text-muted">{d}</p>
            </li>
          ))}
        </ul>
        <div className="mt-6 rounded-lg border border-line bg-white px-5 py-4">
          <p className="font-semibold">{profile?.full_name ?? user.email}</p>
          <p className="mt-0.5 text-[12.5px] text-muted">{user.email} · 그룹장(체험)</p>
        </div>
      </div>
    )
  }

  const [{ data: users }, outletsRes, { data: groups }, { data: authUsers, error: authError }, { data: invites }, membersRes] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at'),
    supabase.from('outlets').select('id, name, publisher_id, publisher:publishers(name)').order('created_at'),
    supabase.from('publishers').select('id, name').order('created_at'),
    supabase.rpc('admin_list_users'),
    supabase.from('invitations').select('id, email, full_name, role, created_at, outlet:outlets(name)').is('accepted_at', null).order('created_at', { ascending: false }),
    // 매체별 소속·직급 (outlet-members.sql 전이면 오류 → 예전처럼 매체 하나)
    supabase.from('outlet_members').select('profile_id, outlet_id, role').order('created_at'),
  ])
  // 회원별 2단계 인증 여부 (account-security.sql 전이면 오류 → 출입 정지·초기화 버튼을 숨긴다)
  const mfaRes = await supabase.rpc('admin_member_mfa')
  const mfa = mfaRes.error ? null : Object.fromEntries(((mfaRes.data ?? []) as { id: string; mfa: boolean }[]).map((r) => [r.id, r.mfa]))
  // 매니저의 담당 매체 (총관리자만, staff-outlets.sql 전이면 오류 → 정하기 버튼을 숨긴다)
  const staffRes = isSuper ? await supabase.from('staff_outlets').select('staff_id, outlet_id') : { data: [], error: null }
  const staffReady = isSuper && !staffRes.error
  const staffOutlets: Record<string, string[]> = {}
  for (const r of (staffRes.data ?? []) as { staff_id: string; outlet_id: string }[]) (staffOutlets[r.staff_id] ??= []).push(r.outlet_id)
  const membershipsReady = !membersRes.error
  const memberships: Record<string, { outletId: string; role: 'reporter' | 'editor' }[]> = {}
  for (const m of (membersRes.data ?? []) as { profile_id: string; outlet_id: string; role: 'reporter' | 'editor' }[]) {
    ;(memberships[m.profile_id] ??= []).push({ outletId: m.outlet_id, role: m.role })
  }
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
  // 매니저는 매체 소속이 아니므로 그룹 회원 표에서 빼고, 아래 매니저 칸에서 담당 매체를 정한다
  const groupMembers = members.filter((u) => !u.is_staff || u.is_super)
  const sections = isSuper
    ? [...(groups ?? []).map((g) => ({ key: g.id as string, title: g.name as string, list: groupMembers.filter((u) => groupIdOf(u) === g.id) })),
       { key: 'none', title: '그룹 없음 (총관리자 등)', list: groupMembers.filter((u) => !groupIdOf(u)) }].filter((s) => s.list.length)
    : [{ key: 'mine', title: '우리 그룹 회원', list: groupMembers }]

  return (
    <div className="mx-auto max-w-[1000px] space-y-8 px-4 py-5 md:px-8 md:py-8">
      <header>
        <h1 className="text-[22px] font-bold tracking-tight">회원 관리</h1>
        <p className="mt-1 text-[13px] text-muted">
          {isSuper ? '모든 그룹의 회원과 가입 신청을 관리합니다.' : '우리 그룹 회원의 역할과 매체를 정하고, 새 기자를 초대합니다.'}
          {' '}기자 = 자기 기사 · 편집장 = 자기 매체 · 발행인 = 그룹의 모든 매체. 기자·편집장은 그룹 안 여러 매체에 소속되고 매체마다 직급을 따로 가질 수 있습니다.
          {' '}퇴사한 사람은 <strong>출입 정지</strong>로 바로 막을 수 있고(쓴 기사는 남음), 휴대폰을 잃어버린 회원은 <strong>2단계 초기화</strong>로 인증 앱을 새로 등록하게 합니다.
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
          <p className="mt-1 text-[12.5px] text-muted">매니저는 매체에 소속되지 않고 직급도 없습니다. 담당 매체만 정하면, 그 매체의 업무요청이 자동으로 배정됩니다.</p>
          {!staffReady && <p className="mt-2 text-[12.5px] text-draft">담당 매체를 정하려면 <code>supabase/staff-outlets.sql</code>을 실행해 주세요.</p>}
          <ul className="mt-3 space-y-2">
            {members.filter((u) => u.is_staff && !u.is_super).map((u) => (
              <StaffRow key={u.id} id={u.id} name={u.full_name} email={info.get(u.id)?.email} outlets={outlets} assigned={staffOutlets[u.id] ?? []} ready={staffReady} />
            ))}
            {!members.some((u) => u.is_staff && !u.is_super) && <li className="text-[13px] text-muted">아직 매니저가 없습니다. 매니저가 가입하면 승인 대기에서 “IM 뉴스룸 매니저”로 승인하거나, 아래에서 지정하세요.</li>}
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
          <UserManager users={s.list} outlets={outlets} currentUserId={user.id} emails={Object.fromEntries(Array.from(info, ([id, a]) => [id, a.email]))} groupOf={groupOf} memberships={membershipsReady ? memberships : null} canDelete={isSuper} mfa={mfa} viewerIsSuper={isSuper} />
        </section>
      ))}
    </div>
  )
}
