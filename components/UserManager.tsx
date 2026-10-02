'use client'

import { useState, useTransition } from 'react'
import { useFormState } from 'react-dom'
import { useRouter } from 'next/navigation'
import { deleteMember, inviteMember, setMember, setMemberships, type FormState, type Membership } from '@/app/(main)/admin/users/actions'
import type { Profile, UserRole } from '@/lib/types'
import { ROLE_LABEL } from '@/lib/types'
import PendingButton from './cms/PendingButton'

export type OutletOption = { id: string; name: string; group: string | null }

function OutletSelect({ outlets, value, onChange, name, id }: { outlets: OutletOption[]; value?: string; onChange?: (v: string) => void; name?: string; id?: string }) {
  const groups = Array.from(new Set(outlets.map((o) => o.group ?? '그룹 없음')))
  return (
    <select id={id} name={name} value={value} onChange={onChange ? (e) => onChange(e.target.value) : undefined} defaultValue={onChange ? undefined : ''} className="rounded border border-line bg-white px-2 py-1.5 text-[13px]">
      <option value="">매체 선택</option>
      {groups.map((g) => (
        <optgroup key={g} label={g}>
          {outlets.filter((o) => (o.group ?? '그룹 없음') === g).map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </optgroup>
      ))}
    </select>
  )
}

export function InviteForm({ outlets }: { outlets: OutletOption[] }) {
  const [state, action] = useFormState<FormState, FormData>(inviteMember, {})
  return (
    <form action={action} className="rounded-lg border border-line bg-white p-5">
      <h2 className="text-[15px] font-bold">회원 초대</h2>
      <p className="mt-1 text-[12.5px] text-muted">이메일로 미리 역할과 매체를 정해 두면, 그 이메일로 가입(구글 가입 포함)하는 순간 승인까지 끝난 상태로 들어옵니다.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input name="email" type="email" required placeholder="이메일" aria-label="이메일" className="field-input w-56" />
        <input name="full_name" placeholder="이름 (선택)" aria-label="이름" className="field-input w-32" />
        <select name="role" defaultValue="reporter" aria-label="역할" className="rounded border border-line bg-white px-2 py-1.5 text-[13px]">
          <option value="reporter">기자</option>
          <option value="editor">편집장</option>
          <option value="admin">발행인 (그룹 전체 관리)</option>
        </select>
        <OutletSelect outlets={outlets} name="outlet_id" />
        <PendingButton pending="보내는 중…" className="btn-primary">초대</PendingButton>
      </div>
      {state.error && <p role="alert" className="mt-2 text-[13px] text-danger">{state.error}</p>}
      {state.ok && <p role="status" className="mt-2 text-[13px] text-published">{state.ok}</p>}
    </form>
  )
}

type Kind = 'member' | 'admin'

function MemberRow({ u, email, outlets, isMe, groupName, memberships, canDelete }: {
  u: Profile; email?: string; outlets: OutletOption[]; isMe: boolean; groupName: string | null
  // 총관리자만: 회원 탈퇴(계정 삭제)
  canDelete: boolean
  // null이면 outlet-members.sql 전: 예전처럼 직급 하나 + 매체 하나
  memberships: Membership[] | null
}) {
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
    <tr className="border-b border-line/60 align-top">
      <td className="py-2.5 pr-2">
        <input value={name} onChange={(e) => setName(e.target.value)} aria-label="이름" maxLength={30} className="w-28 rounded border border-transparent px-1.5 py-1 font-medium hover:border-line focus:border-ink focus:outline-none" />
        {isMe && <span className="ml-1 text-xs text-muted">(나)</span>}
        {u.is_super && <span className="ml-1 rounded bg-[#E5483A] px-1 text-[10.5px] font-bold text-white">총관리자</span>}
        {u.is_staff && !u.is_super && <span className="ml-1 rounded bg-[#2F6BF0] px-1 text-[10.5px] font-bold text-white">매니저</span>}
        {email && <span className="block pl-1.5 text-xs text-muted">{email}</span>}
      </td>
      <td className="py-2.5 pr-2">
        {multi ? (
          <select value={kind} onChange={(e) => setKind(e.target.value as Kind)} disabled={locked} aria-label="직급 방식" className="rounded border border-line bg-white px-2 py-1.5 text-[13px] disabled:opacity-60">
            <option value="member">매체별 직급</option>
            <option value="admin">발행인 (그룹 전체)</option>
          </select>
        ) : (
          <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} disabled={locked} aria-label="역할" className="rounded border border-line bg-white px-2 py-1.5 text-[13px] disabled:opacity-60">
            {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        )}
      </td>
      <td className="py-2.5 pr-2">
        {multi && kind === 'member' && !u.is_staff ? (
          <div className="space-y-1.5">
            {items.map((it, idx) => (
              <div key={it.outletId} className="flex items-center gap-1.5">
                <select
                  value={it.outletId}
                  disabled={locked}
                  onChange={(e) => setItems(items.map((x, j) => (j === idx ? { ...x, outletId: e.target.value } : x)))}
                  aria-label="소속 매체"
                  className="w-40 rounded border border-line bg-white px-2 py-1.5 text-[13px] disabled:opacity-60"
                >
                  {[outlets.find((o) => o.id === it.outletId), ...addable].filter(Boolean).map((o) => <option key={o!.id} value={o!.id}>{o!.name}</option>)}
                </select>
                <select
                  value={it.role}
                  disabled={locked}
                  onChange={(e) => setItems(items.map((x, j) => (j === idx ? { ...x, role: e.target.value as Membership['role'] } : x)))}
                  aria-label="이 매체에서의 직급"
                  className="rounded border border-line bg-white px-2 py-1.5 text-[13px] disabled:opacity-60"
                >
                  <option value="reporter">기자</option>
                  <option value="editor">편집장</option>
                </select>
                {!locked && items.length > 1 && (
                  <button type="button" onClick={() => setItems(items.filter((_, j) => j !== idx))} aria-label="이 매체 소속 빼기" className="px-1 text-[15px] text-muted hover:text-danger">×</button>
                )}
                {u.outlet_id === it.outletId && items.length > 1 && <span className="shrink-0 text-[10.5px] text-muted">지금</span>}
              </div>
            ))}
            {!locked && addable.length > 0 && (
              <button type="button" onClick={() => setItems([...items, { outletId: addable[0].id, role: 'reporter' }])} className="text-[12.5px] font-semibold text-review hover:underline">
                + 매체 추가
              </button>
            )}
            {!items.length && <span className="text-[12px] text-muted">소속 매체 없음</span>}
          </div>
        ) : (
          <>
            <OutletSelect outlets={outlets} value={outlet} onChange={setOutlet} />
            {(multi ? kind === 'admin' : role === 'admin') && <span className="block pt-0.5 text-[11px] text-muted">그룹 전체: {groupName ?? '매체의 그룹'}</span>}
          </>
        )}
      </td>
      <td className="py-2.5 text-xs text-muted">{new Date(u.created_at).toLocaleDateString('ko-KR')}</td>
      <td className="py-2.5 text-right">
        {dirty && (
          <button type="button" disabled={pending} onClick={save} className="btn-primary px-3 py-1 text-[12.5px]">
            {pending ? '저장 중…' : '저장'}
          </button>
        )}
        {canDelete && !isMe && !u.is_super && (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!window.confirm(`${u.full_name}님${email ? `(${email})` : ''}을 탈퇴시킬까요?\n\n· 계정이 삭제되어 더 이상 로그인할 수 없습니다.\n· 쓴 기사는 그대로 남고 기자명도 유지됩니다.\n· 되돌릴 수 없습니다.`)) return
              start(async () => {
                const r = await deleteMember(u.id)
                setMsg(r)
                if (!r.error) router.refresh()
              })
            }}
            className="mt-1 block w-full text-right text-[11.5px] text-muted hover:text-danger"
          >
            탈퇴
          </button>
        )}
        {msg.error && <span role="alert" className="block text-[11.5px] text-danger">{msg.error}</span>}
      </td>
    </tr>
  )
}

export default function UserManager({ users, outlets, currentUserId, emails = {}, groupOf = {}, memberships = null, canDelete = false }: {
  users: Profile[]
  outlets: OutletOption[]
  currentUserId: string
  emails?: Record<string, string>
  groupOf?: Record<string, string | null>
  memberships?: Record<string, Membership[]> | null
  canDelete?: boolean
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white px-5">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[12.5px] text-muted">
            <th className="py-2.5 font-normal">이름 · 이메일</th>
            <th className="w-36 py-2.5 font-normal">직급</th>
            <th className="w-72 py-2.5 font-normal">{memberships ? '소속 매체 · 매체별 직급' : '매체'}</th>
            <th className="w-24 py-2.5 font-normal">가입일</th>
            <th className="w-20" />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <MemberRow key={u.id} u={u} email={emails[u.id]} outlets={outlets} isMe={u.id === currentUserId} groupName={groupOf[u.id] ?? null} memberships={memberships ? memberships[u.id] ?? [] : null} canDelete={canDelete} />
          ))}
          {!users.length && (
            <tr><td colSpan={5} className="py-10 text-center text-sm text-muted">회원이 없습니다.</td></tr>
          )}
        </tbody>
      </table>
      <div className="py-3 text-xs text-muted">총 {users.length}명</div>
    </div>
  )
}
