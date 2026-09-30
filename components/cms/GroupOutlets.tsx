'use client'

import { useState, useTransition } from 'react'
import { useFormState } from 'react-dom'
import { useRouter } from 'next/navigation'
import { createGroup, createOutlet, renameGroup, updateOutlet, type FormState } from '@/app/(main)/admin/outlets/actions'
import { switchOutlet } from '@/app/(main)/account/actions'
import PendingButton from './PendingButton'

type Outlet = { id: string; name: string; domain: string | null; publisher_id: string | null; members: number; articles: number }
type Group = { id: string; name: string }

function OutletRow({ o, groups, isSuper, current }: { o: Outlet; groups: Group[]; isSuper: boolean; current: boolean }) {
  const router = useRouter()
  const [edit, setEdit] = useState(false)
  const [name, setName] = useState(o.name)
  const [domain, setDomain] = useState(o.domain ?? '')
  const [group, setGroup] = useState(o.publisher_id ?? '')
  const [msg, setMsg] = useState('')
  const [pending, start] = useTransition()

  const save = () => start(async () => {
    const r = await updateOutlet(o.id, { name, domain, publisher_id: isSuper ? group : undefined })
    setMsg(r.error ?? '')
    if (!r.error) { setEdit(false); router.refresh() }
  })
  const work = () => start(async () => {
    const r = await switchOutlet(o.id)
    if (r.error) setMsg(r.error)
    else { router.push('/newsroom'); router.refresh() }
  })

  return (
    <li className={`px-5 py-3.5 ${current ? 'bg-[#FFF8E6]' : ''}`}>
      {edit ? (
        <div className="flex flex-wrap items-center gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label="매체 이름" className="field-input w-48" />
          <input value={domain} onChange={(e) => setDomain(e.target.value)} aria-label="도메인" placeholder="도메인 (예: thecaretimes.net)" className="field-input w-60" />
          {isSuper && (
            <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label="그룹" className="field-input w-44">
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
          <button type="button" onClick={save} disabled={pending} className="btn-primary px-3 py-1.5">저장</button>
          <button type="button" onClick={() => setEdit(false)} className="btn-secondary px-3 py-1.5">취소</button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-bold">
              {o.name} {current && <span className="ml-1 rounded bg-[#F2B544] px-1.5 py-0.5 text-[10.5px] text-[#3B2A00]">지금 작업 중</span>}
            </p>
            <p className="mt-0.5 text-[12.5px] text-muted">
              {o.domain ?? '도메인 미연결'} · 회원 {o.members}명 · 기사 {o.articles.toLocaleString()}건
            </p>
          </div>
          {!current && <button type="button" onClick={work} disabled={pending} className="btn-secondary px-3 py-1.5 text-[12.5px]">이 매체로 작업</button>}
          <button type="button" onClick={() => setEdit(true)} className="text-[12.5px] text-muted underline underline-offset-2 hover:text-ink">수정</button>
        </div>
      )}
      {msg && <p role="alert" className="mt-1 text-[12.5px] text-danger">{msg}</p>}
    </li>
  )
}

function GroupName({ g, canRename }: { g: Group; canRename: boolean }) {
  const router = useRouter()
  const [edit, setEdit] = useState(false)
  const [name, setName] = useState(g.name)
  const [pending, start] = useTransition()
  if (!edit) {
    return (
      <h2 className="flex items-center gap-2 text-[16px] font-extrabold">
        {g.name}
        {canRename && <button type="button" onClick={() => setEdit(true)} className="text-[12px] font-normal text-muted underline underline-offset-2">이름 바꾸기</button>}
      </h2>
    )
  }
  return (
    <div className="flex gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} aria-label="그룹 이름" className="field-input w-60" />
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await renameGroup(g.id, name); if (!r.error) { setEdit(false); router.refresh() } else window.alert(r.error) })} className="btn-primary px-3 py-1.5">저장</button>
      <button type="button" onClick={() => setEdit(false)} className="btn-secondary px-3 py-1.5">취소</button>
    </div>
  )
}

export default function GroupOutlets({ groups, outlets, isSuper, myGroupId, currentOutletId }: { groups: Group[]; outlets: Outlet[]; isSuper: boolean; myGroupId: string | null; currentOutletId: string | null }) {
  const [outletState, outletAction] = useFormState<FormState, FormData>(createOutlet, {})
  const [groupState, groupAction] = useFormState<FormState, FormData>(createGroup, {})
  const orphans = outlets.filter((o) => !o.publisher_id || !groups.some((g) => g.id === o.publisher_id))

  return (
    <div className="space-y-6">
      <form action={outletAction} className="rounded-lg border border-line bg-white p-5">
        <h2 className="text-[15px] font-bold">새 매체 만들기</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input name="name" required placeholder="매체 이름 (예: 시니어경제)" aria-label="매체 이름" className="field-input w-56" />
          <input name="domain" placeholder="도메인 (나중에 넣어도 됩니다)" aria-label="도메인" className="field-input w-64" />
          {isSuper && (
            <select name="publisher_id" defaultValue={myGroupId ?? groups[0]?.id} aria-label="그룹" className="field-input w-48">
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
          <PendingButton pending="만드는 중…" className="btn-primary">만들기</PendingButton>
        </div>
        {outletState.error && <p role="alert" className="mt-2 text-[13px] text-danger">{outletState.error}</p>}
        {outletState.ok && <p role="status" className="mt-2 text-[13px] text-published">{outletState.ok}</p>}
      </form>

      {groups.map((g) => {
        const list = outlets.filter((o) => o.publisher_id === g.id)
        return (
          <section key={g.id} className="rounded-lg border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
              <GroupName g={g} canRename />
              <span className="text-[12.5px] text-muted">매체 {list.length}개</span>
            </div>
            <ul className="divide-y divide-line">
              {list.map((o) => <OutletRow key={o.id} o={o} groups={groups} isSuper={isSuper} current={o.id === currentOutletId} />)}
              {!list.length && <li className="px-5 py-6 text-center text-[13px] text-muted">아직 매체가 없습니다.</li>}
            </ul>
          </section>
        )
      })}

      {isSuper && orphans.length > 0 && (
        <section className="rounded-lg border border-danger/30 bg-white">
          <p className="border-b border-line px-5 py-3.5 text-[14px] font-bold text-danger">그룹이 없는 매체 — 수정에서 그룹을 정해 주세요</p>
          <ul className="divide-y divide-line">
            {orphans.map((o) => <OutletRow key={o.id} o={o} groups={groups} isSuper current={o.id === currentOutletId} />)}
          </ul>
        </section>
      )}

      {isSuper && (
        <form action={groupAction} className="rounded-lg border border-dashed border-line bg-white p-5">
          <h2 className="text-[15px] font-bold">새 그룹 만들기 <span className="text-[12px] font-normal text-muted">(새 고객 언론사·발행인마다 하나)</span></h2>
          <div className="mt-3 flex gap-2">
            <input name="name" required placeholder="그룹 이름 (예: ○○미디어)" aria-label="그룹 이름" className="field-input w-72" />
            <PendingButton pending="만드는 중…" className="btn-secondary">그룹 만들기</PendingButton>
          </div>
          {groupState.error && <p role="alert" className="mt-2 text-[13px] text-danger">{groupState.error}</p>}
          {groupState.ok && <p role="status" className="mt-2 text-[13px] text-published">{groupState.ok} 회원 메뉴에서 이 그룹의 발행인을 초대하세요.</p>}
        </form>
      )}
    </div>
  )
}
