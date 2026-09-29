'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Profile, UserRole } from '@/lib/types'
import { ROLE_LABEL } from '@/lib/types'

export default function UserManager({
  users,
  outlets,
  currentUserId,
  emails = {},
}: {
  users: Profile[]
  outlets: { id: string; name: string }[]
  currentUserId: string
  emails?: Record<string, string>
}) {
  const [profiles, setProfiles] = useState(users)
  const router = useRouter()
  const supabase = createClient()

  async function updateRole(id: string, role: UserRole) {
    await supabase.from('profiles').update({ role }).eq('id', id)
    setProfiles(profiles.map(u => u.id === id ? { ...u, role } : u))
    router.refresh()
  }

  async function updateOutlet(id: string, outlet_id: string) {
    await supabase.from('profiles').update({ outlet_id: outlet_id || null }).eq('id', id)
    setProfiles(profiles.map(u => u.id === id ? { ...u, outlet_id: outlet_id || null } : u))
    router.refresh()
  }

  return (
    <div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="py-2.5 font-normal text-muted">이름</th>
            <th className="py-2.5 font-normal text-muted w-28">역할</th>
            <th className="py-2.5 font-normal text-muted w-36">소속 매체</th>
            <th className="py-2.5 font-normal text-muted w-24">가입일</th>
          </tr>
        </thead>
        <tbody>
          {profiles.map((u) => (
            <tr key={u.id} className="border-b border-line/60">
              <td className="py-3 font-medium">
                {u.full_name}
                {u.id === currentUserId && <span className="ml-1.5 text-xs text-muted">(나)</span>}
                {emails[u.id] && <span className="block text-xs font-normal text-muted">{emails[u.id]}</span>}
              </td>
              <td className="py-3">
                {u.id === currentUserId ? (
                  <span className="text-xs text-muted">{ROLE_LABEL[u.role]}</span>
                ) : (
                  <select
                    value={u.role}
                    onChange={(e) => updateRole(u.id, e.target.value as UserRole)}
                    className="rounded border border-line px-2 py-1 text-xs focus:outline-none"
                  >
                    {(Object.keys(ROLE_LABEL) as UserRole[]).map(r => (
                      <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                    ))}
                  </select>
                )}
              </td>
              <td className="py-3">
                <select
                  value={u.outlet_id ?? ''}
                  onChange={(e) => updateOutlet(u.id, e.target.value)}
                  className="rounded border border-line px-2 py-1 text-xs focus:outline-none w-full"
                  disabled={u.id === currentUserId}
                >
                  <option value="">미배정</option>
                  {outlets.map(o => (
                    <option key={o.id} value={o.id}>{o.name}</option>
                  ))}
                </select>
              </td>
              <td className="py-3 text-xs text-muted">
                {new Date(u.created_at).toLocaleDateString('ko-KR')}
              </td>
            </tr>
          ))}
          {!profiles.length && (
            <tr>
              <td colSpan={4} className="py-10 text-center text-sm text-muted">
                회원이 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div className="mt-3 text-xs text-muted">총 {profiles.length}명</div>
    </div>
  )
}
