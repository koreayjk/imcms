'use client'

import { useEffect, useState, useTransition, useActionState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { deleteMember, inviteMember, resetMemberMfa, setMember, setMemberships, signOutMember, suspendMember, suspendDormant, type FormState, type Membership } from '@/app/(main)/admin/users/actions'
import type { Profile, UserRole } from '@/lib/types'
import { roleLabel } from '@/lib/types'
import { useCmsLang, useT } from './cms/CmsLang'
import PendingButton from './cms/PendingButton'
import { isDormant } from '@/lib/device'
import RowMenu from './cms/RowMenu'

export type OutletOption = { id: string; name: string; group: string | null }

function OutletSelect({ outlets, value, onChange, name, id }: { outlets: OutletOption[]; value?: string; onChange?: (v: string) => void; name?: string; id?: string }) {
  const t = useT()
  const noGroup = t('그룹 없음', 'No group')
  const groups = Array.from(new Set(outlets.map((o) => o.group ?? noGroup)))
  return (
    <select id={id} name={name} value={value} onChange={onChange ? (e) => onChange(e.target.value) : undefined} defaultValue={onChange ? undefined : ''} className="max-w-full rounded border border-line bg-white px-2 py-1.5 text-[13px]">
      <option value="">{t('매체 선택', 'Choose an outlet')}</option>
      {groups.map((g) => (
        <optgroup key={g} label={g}>
          {outlets.filter((o) => (o.group ?? noGroup) === g).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </optgroup>
      ))}
    </select>
  )
}

export function InviteForm({ outlets }: { outlets: OutletOption[] }) {
  const t = useT()
  const lang = useCmsLang()
  const [state, action] = useActionState<FormState, FormData>(inviteMember, {})
  return (
    <form action={action} className="rounded-lg border border-line bg-white p-5">
      <h2 className="text-[15px] font-bold">{t('회원 초대', 'Invite a member')}</h2>
      <p className="mt-1 text-[12.5px] text-muted">{t('이메일로 미리 역할과 매체를 정해 두면, 그 이메일로 가입(구글 가입 포함)하는 순간 승인까지 끝난 상태로 들어옵니다.', 'Set the role and outlet in advance by email, and the moment they sign up with that email (Google sign-up included) they come in already approved.')}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input name="email" type="email" required placeholder={t('이메일', 'Email')} aria-label={t('이메일', 'Email')} className="field-input w-full sm:w-56" />
        <input name="full_name" placeholder={t('이름 (선택)', 'Name (optional)')} aria-label={t('이름', 'Name')} className="field-input w-32" />
        <select name="role" defaultValue="reporter" aria-label={t('역할', 'Role')} className="rounded border border-line bg-white px-2 py-1.5 text-[13px]">
          <option value="reporter">{roleLabel('reporter', lang)}</option>
          <option value="editor">{roleLabel('editor', lang)}</option>
          <option value="admin">{t('발행인 (그룹 전체 관리)', 'Publisher (manages the whole group)')}</option>
        </select>
        <OutletSelect outlets={outlets} name="outlet_id" />
        <PendingButton pending={t('보내는 중…', 'Sending…')} className="btn-primary">{t('초대', 'Invite')}</PendingButton>
      </div>
      {state.error && <p role="alert" className="mt-2 text-[13px] text-danger">{state.error}</p>}
      {state.ok && <p role="status" className="mt-2 text-[13px] text-published">{state.ok}</p>}
    </form>
  )
}

type Kind = 'member' | 'admin'

function MemberRow({ u, email, outlets, isMe, groupName, memberships, canDelete, mfa, viewerIsSuper, lastSeen, loginsReady }: {
  u: Profile; email?: string; outlets: OutletOption[]; isMe: boolean; groupName: string | null
  // 마지막 접속 (모르면 undefined) · 로그인 기록·원격 로그아웃을 쓸 수 있는가 (login-security.sql)
  lastSeen?: string | null
  loginsReady: boolean
  // 총관리자만: 회원 탈퇴(계정 삭제)
  canDelete: boolean
  // 2단계 인증을 켰는가 (account-security.sql 전이면 undefined)
  mfa?: boolean
  viewerIsSuper: boolean
  // null이면 outlet-members.sql 전: 예전처럼 직급 하나 + 매체 하나
  memberships: Membership[] | null
}) {
  const t = useT()
  const lang = useCmsLang()
  const dateLoc = lang === 'en' ? 'en-US' : 'ko-KR'
  const router = useRouter()
  const initialItems: Membership[] = memberships?.length
    ? memberships
    : u.outlet_id && u.role !== 'admin' ? [{ outletId: u.outlet_id, role: u.role === 'editor' ? 'editor' : 'reporter' }] : []
  const [kind, setKind] = useState<Kind>(u.role === 'admin' ? 'admin' : 'member')
  const [items, setItems] = useState<Membership[]>(initialItems)
  const [role, setRole] = useState<UserRole>(u.role)
  const [outlet, setOutlet] = useState(u.outlet_id ?? '')
  const [name, setName] = useState(u.full_name)
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({})
  const [pending, start] = useTransition()
  const multi = memberships !== null
  const locked = isMe || !!u.is_super || !!u.is_staff
  // 출입 정지·2단계 인증 초기화: 발행인은 우리 그룹 기자·편집장, 총관리자는 모두 (DB가 한 번 더 확인)
  const canManage = !isMe && !u.is_super && (viewerIsSuper || (!u.is_staff && u.role !== 'admin'))
  const canGuard = mfa !== undefined && canManage
  const canWatch = loginsReady && canManage
  const dormant = lastSeen !== undefined && isDormant(lastSeen, u.created_at)
  const suspended = !!u.suspended_at

  function guard(run: () => Promise<FormState>, question: string) {
    if (!window.confirm(question)) return
    start(async () => {
      const r = await run()
      setMsg(r)
      if (!r.error) router.refresh()
    })
  }

  const sameItems = JSON.stringify(items) === JSON.stringify(initialItems)
  const dirty = name !== u.full_name || (multi
    ? kind !== (u.role === 'admin' ? 'admin' : 'member') || (kind === 'member' ? !sameItems : outlet !== (u.outlet_id ?? ''))
    : role !== u.role || outlet !== (u.outlet_id ?? ''))

  // 같은 그룹 매체만 고를 수 있다 (첫 매체의 그룹 기준)
  const groupOfOutlet = (id: string) => outlets.find((o) => o.id === id)?.group ?? null
  const baseGroup = items[0] ? groupOfOutlet(items[0].outletId) : groupName
  const sameGroupOutlets = baseGroup ? outlets.filter((o) => o.group === baseGroup) : outlets
  const addable = sameGroupOutlets.filter((o) => !items.some((i) => i.outletId === o.id))

  function save() {
    start(async () => {
      const r = multi && kind === 'member'
        ? await setMemberships(u.id, items, name)
        : await setMember(u.id, { role: multi ? 'admin' : role, outletId: outlet || null, fullName: name })
      setMsg(r)
      if (!r.error) router.refresh()
    })
  }

  return (
    // 휴대폰(md 미만)에서는 표 대신 카드: 이름 줄 오른쪽에 저장·메뉴, 그 아래 직급·매체·가입일이 차례로
    <tr className="relative flex flex-wrap items-start gap-x-3 gap-y-2 border-b border-line/60 py-3 md:table-row md:py-0 md:align-top">
      <td className="basis-full pr-24 md:py-2.5 md:pr-2">
        <input value={name} onChange={(e) => setName(e.target.value)} aria-label={t('이름', 'Name')} maxLength={30} className="w-28 rounded border border-transparent px-1.5 py-1 font-medium hover:border-line focus:border-ink focus:outline-none" />
        {isMe && <span className="ml-1 text-xs text-muted">{t('(나)', '(you)')}</span>}
        {u.is_super && <span className="ml-1 rounded bg-[#E5483A] px-1 text-[10.5px] font-bold text-white">{t('총관리자', 'Super Admin')}</span>}
        {u.is_staff && !u.is_super && <span className="ml-1 rounded bg-[#2F6BF0] px-1 text-[10.5px] font-bold text-white">{t('매니저', 'Manager')}</span>}
        {suspended && <span className="ml-1 rounded bg-danger px-1 text-[10.5px] font-bold text-white">{t('출입 정지', 'Suspended')}</span>}
        {dormant && !suspended && <span title={t('1년 이상 접속하지 않음', 'No login for over a year')} className="ml-1 rounded bg-draft/15 px-1 text-[10.5px] font-bold text-draft">{t('1년 미접속', '1 yr inactive')}</span>}
        {mfa && <span title={t('2단계 인증 켬', 'Two-step verification on')} className="ml-1 rounded bg-published/10 px-1 text-[10.5px] font-bold text-published">{t('2단계', '2-step')}</span>}
        {email && <span className="block break-all pl-1.5 text-xs text-muted">{email}</span>}
      </td>
      <td className="md:py-2.5 md:pr-2">
        {multi ? (
          <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} disabled={locked} aria-label={t('직급 방식', 'Role type')} className="rounded border border-line bg-white px-2 py-1.5 text-[13px] disabled:opacity-60">
            <option value="member">{t('매체별 직급', 'Role per outlet')}</option>
            <option value="admin">{t('발행인 (그룹 전체)', 'Publisher (whole group)')}</option>
          </select>
        ) : (
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} disabled={locked} aria-label={t('역할', 'Role')} className="rounded border border-line bg-white px-2 py-1.5 text-[13px] disabled:opacity-60">
            {(['reporter', 'editor', 'admin'] as UserRole[]).map((r) => <option key={r} value={r}>{roleLabel(r, lang)}</option>)}
          </select>
        )}
      </td>
      <td className="min-w-0 md:py-2.5 md:pr-2">
        {multi && kind === 'member' && !u.is_staff ? (
          <div className="space-y-1.5">
            {items.map((it, idx) => (
              <div key={it.outletId} className="flex items-center gap-1.5">
                <select
                  value={it.outletId}
                  disabled={locked}
                  onChange={(e) => setItems(items.map((x, j) => (j === idx ? { ...x, outletId: e.target.value } : x)))}
                  aria-label={t('소속 매체', 'Outlet')}
                  className="w-36 min-w-0 rounded border border-line bg-white px-2 py-1.5 text-[13px] disabled:opacity-60 md:w-40"
                >
                  {[outlets.find((o) => o.id === it.outletId), ...addable].filter(Boolean).map((o) => <option key={o!.id} value={o!.id}>{o!.name}</option>)}
                </select>
                <select
                  value={it.role}
                  disabled={locked}
                  onChange={(e) => setItems(items.map((x, j) => (j === idx ? { ...x, role: e.target.value as Membership['role'] } : x)))}
                  aria-label={t('이 매체에서의 직급', 'Role at this outlet')}
                  className="rounded border border-line bg-white px-2 py-1.5 text-[13px] disabled:opacity-60"
                >
                  <option value="reporter">{roleLabel('reporter', lang)}</option>
                  <option value="editor">{roleLabel('editor', lang)}</option>
                </select>
                {!locked && items.length > 1 && (
                  <button type="button" onClick={() => setItems(items.filter((_, j) => j !== idx))} aria-label={t('이 매체 소속 빼기', 'Remove from this outlet')} className="px-1 text-[15px] text-muted hover:text-danger">×</button>
                )}
                {u.outlet_id === it.outletId && items.length > 1 && <span className="shrink-0 text-[10.5px] text-muted">{t('지금', 'Current')}</span>}
              </div>
            ))}
            {!locked && addable.length > 0 && (
              <button type="button" onClick={() => setItems([...items, { outletId: addable[0].id, role: 'reporter' }])} className="text-[12.5px] font-semibold text-review hover:underline">
                {t('+ 매체 추가', '+ Add outlet')}
              </button>
            )}
            {!items.length && <span className="text-[12px] text-muted">{t('소속 매체 없음', 'No outlets')}</span>}
          </div>
        ) : (
          <>
            <OutletSelect outlets={outlets} value={outlet} onChange={setOutlet} />
            {(multi ? kind === 'admin' : role === 'admin') && <span className="block pt-0.5 text-[11px] text-muted">{t('그룹 전체:', 'Whole group:')} {groupName ?? t('매체의 그룹', 'the outlet\'s group')}</span>}
          </>
        )}
      </td>
      <td className="basis-full text-xs text-muted md:py-2.5">
        {new Date(u.created_at).toLocaleDateString(dateLoc)}
        {lastSeen !== undefined && (
          <span className={`ml-2 pt-0.5 md:ml-0 md:block ${dormant ? 'font-semibold text-draft' : ''}`} title={t('최근 접속', 'Last login')}>
            {lastSeen ? `${t('접속', 'Last login')} ${new Date(lastSeen).toLocaleDateString(dateLoc)}` : t('접속 기록 없음', 'No login record')}
          </span>
        )}
      </td>
      <td className="absolute right-0 top-2.5 text-right md:static md:py-2.5">
        {dirty && (
          <button type="button" disabled={pending} onClick={save} className="btn-primary mr-1.5 px-3 py-1 text-[12.5px]">
            {pending ? t('저장 중…', 'Saving…') : t('저장', 'Save')}
          </button>
        )}
        <RowMenu
          disabled={pending}
          items={[
            viewerIsSuper && !isMe && { label: t('고객센터로 안내 보내기', 'Send a message via Support'), href: `/support/tickets/new?to=${u.id}` },
            canWatch && { label: t('로그인 기록', 'Login history'), href: `/admin/users/${u.id}/logins` },
            canWatch && { label: t('모든 기기 로그아웃', 'Sign out of all devices'), onClick: () => guard(() => signOutMember(u.id), t(`${u.full_name}님의 로그인을 모든 기기에서 끊을까요?\n\n바로 편집국을 열 수 없게 되고, 다시 로그인해야 합니다.`, `Sign ${u.full_name} out of all devices?\n\nThey will immediately lose access to the newsroom and will need to log in again.`)) },
            canGuard && mfa && { label: t('2단계 인증 초기화', 'Reset two-step verification'), onClick: () => guard(() => resetMemberMfa(u.id), t(`${u.full_name}님의 2단계 인증을 초기화할까요?\n\n휴대폰을 잃어버렸을 때 씁니다. 다음 로그인 때 인증 앱을 새로 등록합니다. 본인이 맞는지 꼭 확인하세요.`, `Reset ${u.full_name}'s two-step verification?\n\nUse this when they have lost their phone. They will register the authenticator app again at their next login. Be sure to confirm it is really them.`)) },
            canGuard && {
              label: suspended ? t('정지 풀기', 'Lift suspension') : t('출입 정지', 'Suspend access'),
              tone: suspended ? 'strong' as const : 'danger' as const,
              onClick: () => guard(
                () => suspendMember(u.id, !suspended),
                suspended
                  ? t(`${u.full_name}님의 출입 정지를 풀까요? 다시 편집국을 쓸 수 있게 됩니다.`, `Lift the suspension for ${u.full_name}? They will be able to use the newsroom again.`)
                  : t(`${u.full_name}님의 편집국 출입을 정지할까요?\n\n· 바로 편집국과 기사·자료를 열 수 없게 됩니다 (자기 기사 수정·삭제 포함).\n· 쓴 기사는 기자명 그대로 남습니다.\n· 언제든 정지를 풀 수 있습니다.`, `Suspend ${u.full_name}'s access to the newsroom?\n\n· They will immediately lose access to the newsroom, stories and files (including editing or deleting their own stories).\n· Stories they wrote remain under their byline.\n· You can lift the suspension at any time.`),
              ),
            },
            canDelete && !isMe && !u.is_super && {
              label: t('탈퇴', 'Remove account'), tone: 'danger' as const,
              onClick: () => {
                if (!window.confirm(t(`${u.full_name}님${email ? `(${email})` : ''}을 탈퇴시킬까요?\n\n· 계정이 삭제되어 더 이상 로그인할 수 없습니다.\n· 쓴 기사는 그대로 남고 기자명도 유지됩니다.\n· 되돌릴 수 없습니다.`, `Remove ${u.full_name}${email ? ` (${email})` : ''} from the service?\n\n· The account will be deleted and can no longer log in.\n· Stories they wrote remain, and the byline is kept.\n· This cannot be undone.`))) return
                start(async () => {
                  const r = await deleteMember(u.id)
                  setMsg(r)
                  if (!r.error) router.refresh()
                })
              },
            },
          ]}
        />
        {msg.error && <span role="alert" className="block text-[11.5px] text-danger">{msg.error}</span>}
        {msg.ok && !msg.error && !dirty && <span role="status" className="block text-[11.5px] text-published">{msg.ok}</span>}
      </td>
    </tr>
  )
}

export default function UserManager({ users, outlets, currentUserId, emails = {}, groupOf = {}, memberships = null, canDelete = false, mfa = null, viewerIsSuper = false, lastSeen = null, loginsReady = false }: {
  users: Profile[]
  outlets: OutletOption[]
  currentUserId: string
  emails?: Record<string, string>
  groupOf?: Record<string, string | null>
  memberships?: Record<string, Membership[]> | null
  canDelete?: boolean
  // 회원별 2단계 인증 여부 (account-security.sql 전이면 null → 정지·초기화 버튼을 숨긴다)
  mfa?: Record<string, boolean> | null
  viewerIsSuper?: boolean
  // 회원별 마지막 접속 (모르면 null → 칸을 숨긴다)
  lastSeen?: Record<string, string | null> | null
  loginsReady?: boolean
}) {
  const t = useT()
  return (
    <div className="rounded-lg border border-line bg-white px-4 md:overflow-x-auto md:px-5">
      <table className="block w-full text-sm md:table md:min-w-[720px]">
        <thead className="hidden md:table-header-group">
          <tr className="border-b border-line text-left text-[12.5px] text-muted">
            <th className="py-2.5 font-normal">{t('이름 · 이메일', 'Name · Email')}</th>
            <th className="w-36 py-2.5 font-normal">{t('직급', 'Role')}</th>
            <th className="w-72 py-2.5 font-normal">{memberships ? t('소속 매체 · 매체별 직급', 'Outlets · role per outlet') : t('매체', 'Outlet')}</th>
            <th className="w-24 py-2.5 font-normal">{lastSeen ? t('가입 · 최근 접속', 'Joined · Last login') : t('가입일', 'Joined')}</th>
            <th className="w-24" />
          </tr>
        </thead>
        <tbody className="block md:table-row-group">
          {users.map((u) => (
            <MemberRow key={u.id} u={u} email={emails[u.id]} outlets={outlets} isMe={u.id === currentUserId} groupName={groupOf[u.id] ?? null} memberships={memberships ? memberships[u.id] ?? [] : null} canDelete={canDelete} mfa={mfa ? !!mfa[u.id] : undefined} viewerIsSuper={viewerIsSuper} lastSeen={lastSeen ? lastSeen[u.id] ?? null : undefined} loginsReady={loginsReady} />
          ))}
          {!users.length && (
            <tr className="block md:table-row"><td colSpan={5} className="block py-10 md:table-cell text-center text-sm text-muted">{t('회원이 없습니다.', 'No members.')}</td></tr>
          )}
        </tbody>
      </table>
      <div className="py-3 text-xs text-muted">{t(`총 ${users.length}명`, `${users.length} ${users.length === 1 ? 'member' : 'members'} in total`)}</div>
    </div>
  )
}

// 1년 이상 접속하지 않은 회원: 한 번에 출입 정지 (탈퇴는 총관리자가 표에서 한 명씩)
export function DormantMembers({ list, canDelete }: {
  list: { id: string; name: string; email?: string; group: string | null; lastSeen: string | null }[]
  canDelete: boolean
}) {
  const t = useT()
  const lang = useCmsLang()
  const router = useRouter()
  const [msg, setMsg] = useState<FormState>({})
  const [pending, start] = useTransition()
  function run() {
    if (!window.confirm(t(`1년 이상 접속하지 않은 ${list.length}명의 편집국 출입을 정지할까요?\n\n· 다시 로그인해도 편집국을 열 수 없습니다.\n· 쓴 기사는 그대로 남습니다.\n· 다시 일하게 되면 언제든 '정지 풀기'로 되돌릴 수 있습니다.`, `Suspend newsroom access for the ${list.length} ${list.length === 1 ? 'person' : 'people'} who have not logged in for over a year?\n\n· They will not be able to open the newsroom even if they log in again.\n· Stories they wrote remain.\n· If they start working again, you can restore access any time with “Lift suspension”.`))) return
    start(async () => {
      const r = await suspendDormant(list.map((m) => m.id))
      setMsg(r)
      router.refresh()
    })
  }
  return (
    <section className="rounded-lg border border-draft/40 bg-draft/5 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold">{t('1년 이상 접속하지 않은 회원', 'Members inactive for over a year')} <span className="text-[12.5px] font-normal text-muted">{t(`${list.length}명`, `${list.length} ${list.length === 1 ? 'person' : 'people'}`)}</span></h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
            {t('오래 쓰지 않는 계정은 비밀번호가 새도 알아차리기 어렵습니다. 그만둔 사람이면 출입을 정지해 두세요(기사는 남고, 언제든 되돌릴 수 있습니다).', 'A password leak on an account nobody uses is hard to notice. If the person has left, suspend their access (their stories remain and you can undo it at any time).')}
            {canDelete && t(' 완전히 지우려면 아래 표에서 한 명씩 탈퇴시킬 수 있습니다.', ' To delete an account completely, remove members one by one from the table below.')}
          </p>
        </div>
        <button type="button" onClick={run} disabled={pending} className="btn-secondary shrink-0 bg-white px-3 py-1.5 text-[13px] disabled:opacity-50">
          {pending ? t('정지하는 중…', 'Suspending…') : t(`${list.length}명 모두 출입 정지`, `Suspend all ${list.length}`)}
        </button>
      </div>
      <ul className="mt-3 divide-y divide-line rounded-md border border-line bg-white">
        {list.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-4 py-2 text-[13px]">
            <span className="font-semibold">{m.name}</span>
            <span className="min-w-0 break-all text-[12px] text-muted">{[m.email, m.group].filter(Boolean).join(' · ')}</span>
            <span className="ml-auto text-[12px] tabular-nums text-draft">{m.lastSeen ? `${t('마지막 접속', 'Last login')} ${new Date(m.lastSeen).toLocaleDateString(lang === 'en' ? 'en-US' : 'ko-KR')}` : t('접속한 적 없음', 'Never logged in')}</span>
          </li>
        ))}
      </ul>
      {msg.error && <p role="alert" className="mt-2 text-[12.5px] text-danger">{msg.error}</p>}
      {msg.ok && !msg.error && <p role="status" className="mt-2 text-[12.5px] text-published">{msg.ok}</p>}
    </section>
  )
}
