'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteMember, setStaff, setStaffOutlets } from '@/app/(main)/admin/users/actions'
import { useT } from './CmsLang'
import PendingButton from './PendingButton'

type Outlet = { id: string; name: string; group: string | null }

// IM 뉴스룸 매니저 한 명: 직급 없이 담당 매체만 정한다
export default function StaffRow({ id, name, email, outlets, assigned, ready }: {
  id: string; name: string; email?: string; outlets: Outlet[]; assigned: string[]; ready: boolean
}) {
  const t = useT()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<string[]>(assigned)
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({})
  const [pending, start] = useTransition()
  const noGroup = t('그룹 없음', 'No group')
  const groups = Array.from(new Set(outlets.map((o) => o.group ?? noGroup)))
  const names = assigned.map((a) => outlets.find((o) => o.id === a)?.name).filter(Boolean) as string[]

  return (
    <li className="rounded-lg bg-white px-4 py-3 ring-1 ring-line">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]">
        <strong>{name}</strong>
        {email && <span className="min-w-0 break-all text-muted">{email}</span>}
        {/* 좁은 화면에서 글자 하나씩 세로로 찌그러지지 않게: 자리가 모자라면 다음 줄로 내려가 한 줄을 다 쓴다 */}
        <span className="min-w-[12rem] flex-1 text-[12.5px]">
          {t('담당 매체:', 'Assigned outlets:')}{' '}
          {names.length ? <span className="font-semibold">{names.join(', ')}</span> : <span className="text-muted">{t('아직 없음', 'None yet')}</span>}
        </span>
        <span className="flex items-center gap-3">
        {ready && (
          <button type="button" onClick={() => { setOpen(!open); setPicked(assigned); setMsg({}) }} className="text-[12.5px] font-semibold text-[#2F6BF0] hover:underline">
            {open ? t('닫기', 'Close') : t('담당 매체 정하기', 'Assign outlets')}
          </button>
        )}
        <form action={setStaff.bind(null, id, false)}>
          <PendingButton pending="…" confirm={t(`${name}님을 매니저에서 해제할까요? 담당 매체도 함께 지워집니다.`, `Remove ${name} as a manager? Their assigned outlets will also be cleared.`)} className="text-[12px] text-muted underline underline-offset-2 hover:text-danger">{t('해제', 'Remove')}</PendingButton>
        </form>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(t(`${name}님${email ? `(${email})` : ''}을 탈퇴시킬까요?\n\n· 계정이 삭제되어 더 이상 로그인할 수 없습니다.\n· 고객 업무요청에 남긴 답변은 그대로 남습니다.\n· 되돌릴 수 없습니다.`, `Remove ${name}${email ? ` (${email})` : ''} from the service?\n\n· The account will be deleted and can no longer log in.\n· Replies they left on customer Support requests will remain.\n· This cannot be undone.`))) return
            start(async () => {
              const r = await deleteMember(id)
              setMsg(r)
              if (!r.error) router.refresh()
            })
          }}
          className="text-[12px] text-muted underline underline-offset-2 hover:text-danger"
        >
          {t('탈퇴', 'Remove account')}
        </button>
        </span>
      </div>

      {open && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.map((g) => (
              <fieldset key={g} className="rounded border border-line px-3 py-2">
                <legend className="px-1 text-[12px] font-semibold text-muted">{g}</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {outlets.filter((o) => (o.group ?? noGroup) === g).map((o) => (
                    <label key={o.id} className="flex items-center gap-1.5 text-[13px]">
                      <input
                        type="checkbox"
                        checked={picked.includes(o.id)}
                        onChange={(e) => setPicked(e.target.checked ? [...picked, o.id] : picked.filter((x) => x !== o.id))}
                      />
                      {o.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              disabled={pending}
              onClick={() => start(async () => {
                const r = await setStaffOutlets(id, picked)
                setMsg(r)
                if (!r.error) { setOpen(false); router.refresh() }
              })}
              className="btn-primary px-4 py-1.5 text-[13px]"
            >
              {pending ? t('저장 중…', 'Saving…') : t(`저장 (${picked.length}개 매체)`, `Save (${picked.length} ${picked.length === 1 ? 'outlet' : 'outlets'})`)}
            </button>
            <span className="text-[12px] text-muted">{t('담당 매체에서 들어오는 업무요청은 이 매니저에게 자동으로 배정됩니다.', 'Support requests coming from assigned outlets are automatically assigned to this manager.')}</span>
          </div>
        </div>
      )}
      {msg.error && <p role="alert" className="mt-1.5 text-[12.5px] text-danger">{msg.error}</p>}
    </li>
  )
}
