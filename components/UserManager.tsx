'use client'

import { useState, useTransition } from 'react'
import { useFormState } from 'react-dom'
import { useRouter } from 'next/navigation'
import { inviteMember, setMember, type FormState } from '@/app/(main)/admin/users/actions'
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

function MemberRow({ u, email, outlets, isMe, groupName }: { u: Profile; email?: string; outlets: OutletOption[]; isMe: boolean; groupName: string | null }) {
  const router = useRouter()
  const [role, setRole] = useState<UserRole>(u.role)
  const [outlet, setOutlet] = useState(u.outlet_id ?? '')
  const [name, setName] = useState(u.full_name)
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({})
  const [pending, start] = useTransition()
  const dirty = role !== u.role || outlet !== (u.outlet_id ?? '') || name !== u.full_name

  return (
    <tr className="border-b border-line/60 align-middle">
      <td className="py-2.5 pr-2">
        <input value={name} onChange={(e) => setName(e.target.value)} aria-label="이름" maxLength={30} className="w-28 rounded border border-transparent px-1.5 py-1 font-medium hover:border-line focus:border-ink focus:outline-none" />
        {isMe && <span className="ml-1 text-xs text-muted">(나)</span>}
        {u.is_super && <span className="ml-1 rounded bg-[#E5483A] px-1 text-[10.5px] font-bold text-white">총관리자</span>}
        {email && <span className="block pl-1.5 text-xs text-muted">{email}</span>}
      </td>
      <td className="py-2.5 pr-2">
        <select value={role} onChange={(e) => setRole(e.target.value as UserRole)} disabled={isMe || u.is_super} aria-label="역할" className="rounded border border-line bg-white px-2 py-1.5 text-[13px] disabled:opacity-60">
          {(Object.keys(ROLE_LABEL) as UserRole[]).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
        </select>
      </td>
      <td className="py-2.5 pr-2">
        <OutletSelect outlets={outlets} value={outlet} onChange={setOutlet} />
        {role === 'admin' && <span className="block pt-0.5 text-[11px] text-muted">그룹 전체: {groupName ?? '매체의 그룹'}</span>}
      </td>
      <td className="py-2.5 text-xs text-muted">{new Date(u.created_at).toLocaleDateString('ko-KR')}</td>
      <td className="py-2.5 text-right">
        {dirty && (
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => {
              const r = await setMember(u.id, { role, outletId: outlet || null, fullName: name })
              setMsg(r)
              if (!r.error) router.refresh()
            })}
            className="btn-primary px-3 py-1 text-[12.5px]"
          >
            {pending ? '저장 중…' : '저장'}
          </button>
        )}
        {msg.error && <span role="alert" className="block text-[11.5px] text-danger">{msg.error}</span>}
      </td>
    </tr>
  )
}

export default function UserManager({ users, outlets, currentUserId, emails = {}, groupOf = {} }: {
  users: Profile[]
  outlets: OutletOption[]
  currentUserId: string
  emails?: Record<string, string>
  groupOf?: Record<string, string | null>
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line bg-white px-5">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-[12.5px] text-muted">
            <th className="py-2.5 font-normal">이름 · 이메일</th>
            <th className="w-28 py-2.5 font-normal">역할</th>
            <th className="w-52 py-2.5 font-normal">매체</th>
            <th className="w-24 py-2.5 font-normal">가입일</th>
            <th className="w-20" />
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <MemberRow key={u.id} u={u} email={emails[u.id]} outlets={outlets} isMe={u.id === currentUserId} groupName={groupOf[u.id] ?? null} />
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
