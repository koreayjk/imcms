'use client'

import { useState, useTransition, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { createGroup, createOutlet, deleteGroup, renameGroup, updateOutlet, type FormState } from '@/app/(main)/admin/outlets/actions'
import { SOLO } from '@/lib/groups'
import { switchOutlet } from '@/app/(main)/account/actions'
import { previewUrl } from '@/lib/product'
import { useT } from './CmsLang'
import PendingButton from './PendingButton'

type Outlet = { id: string; name: string; domain: string | null; publisher_id: string | null; members: number; articles: number }
// solo: 개별 매체용 숨은 그룹 (화면에서는 '개별 매체' 한 곳에 모아 보여준다)
type Group = { id: string; name: string; solo?: boolean }

function OutletRow({ o, groups, canManage, canMove, current }: { o: Outlet; groups: Group[]; canManage: boolean; canMove: boolean; current: boolean }) {
  const t = useT()
  const router = useRouter()
  const [edit, setEdit] = useState(false)
  const [name, setName] = useState(o.name)
  const [domain, setDomain] = useState(o.domain ?? '')
  const isSolo = groups.find((g) => g.id === o.publisher_id)?.solo ?? false
  const initialGroup = isSolo ? SOLO : o.publisher_id ?? ''
  const [group, setGroup] = useState(initialGroup)
  const [msg, setMsg] = useState('')
  const [pending, start] = useTransition()

  const save = () => start(async () => {
    // 그룹은 바뀐 경우에만 넘긴다
    const r = await updateOutlet(o.id, { name, domain, publisher_id: group && group !== initialGroup ? group : undefined })
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
          <input value={name} onChange={(e) => setName(e.target.value)} aria-label={t('매체 이름', 'Outlet name')} className="field-input w-48" />
          <input value={domain} onChange={(e) => setDomain(e.target.value)} aria-label={t('도메인', 'Domain')} placeholder={t('도메인 (예: thecaretimes.net)', 'Domain (e.g. thecaretimes.net)')} className="field-input w-60" />
          {canMove && (
            <select value={group} onChange={(e) => setGroup(e.target.value)} aria-label={t('그룹', 'Group')} className="field-input w-44">
              <option value={SOLO}>{t('개별 매체 (그룹 없음)', 'Standalone outlet (no group)')}</option>
              {groups.filter((g) => !g.solo).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
          <button type="button" onClick={save} disabled={pending} className="btn-primary px-3 py-1.5">{t('저장', 'Save')}</button>
          <button type="button" onClick={() => setEdit(false)} className="btn-secondary px-3 py-1.5">{t('취소', 'Cancel')}</button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-[12rem] flex-1">
            <p className="font-bold">
              {o.name} {current && <span className="ml-1 rounded bg-[#F2B544] px-1.5 py-0.5 text-[10.5px] text-[#3B2A00]">{t('지금 작업 중', 'Working on now')}</span>}
            </p>
            <p className="mt-0.5 break-words text-[12.5px] text-muted">
              {o.domain ?? t('도메인 미연결', 'No domain connected')} · {t(`회원 ${o.members}명`, `${o.members} ${o.members === 1 ? 'member' : 'members'}`)} · {t(`기사 ${o.articles.toLocaleString()}건`, `${o.articles.toLocaleString('en-US')} ${o.articles === 1 ? 'story' : 'stories'}`)}
            </p>
          </div>
          {o.domain && <a href={`https://${o.domain}`} target="_blank" rel="noopener" className="text-[12.5px] text-muted underline underline-offset-2 hover:text-ink">{t('홈페이지 ↗', 'Website ↗')}</a>}
          <a href={previewUrl(o.id)} target="_blank" rel="noopener" className="text-[12.5px] text-muted underline underline-offset-2 hover:text-ink">{t('미리보기 ↗', 'Preview ↗')}</a>
          {canManage && <a href={`/admin/outlets/${o.id}/site`} className="btn-primary px-3 py-1.5 text-[12.5px]">{t('홈페이지 설정', 'Website settings')}</a>}
          {!current && <button type="button" onClick={work} disabled={pending} className="btn-secondary px-3 py-1.5 text-[12.5px]">{t('이 매체로 작업', 'Work on this outlet')}</button>}
          {canManage && <button type="button" onClick={() => setEdit(true)} className="text-[12.5px] text-muted underline underline-offset-2 hover:text-ink">{t('수정', 'Edit')}</button>}
        </div>
      )}
      {msg && <p role="alert" className="mt-1 text-[12.5px] text-danger">{msg}</p>}
    </li>
  )
}

function GroupName({ g, canRename, canDelete, count }: { g: Group; canRename: boolean; canDelete: boolean; count: number }) {
  const t = useT()
  const router = useRouter()
  const [edit, setEdit] = useState(false)
  const [name, setName] = useState(g.name)
  const [pending, start] = useTransition()
  const remove = () => {
    const msg = count
      ? t(`‘${g.name}’ 그룹을 지울까요?\n안에 있는 매체 ${count}개는 지워지지 않고 '개별 매체'로 옮겨집니다. 각 매체의 기사·회원·발행인은 그대로입니다.`, `Delete the group ‘${g.name}’?\nThe ${count} ${count === 1 ? 'outlet' : 'outlets'} inside will not be deleted; ${count === 1 ? 'it' : 'they'} will be moved to “Standalone outlets”. Each outlet's stories, members and publisher stay as they are.`)
      : t(`‘${g.name}’ 그룹을 지울까요?`, `Delete the group ‘${g.name}’?`)
    if (!window.confirm(msg)) return
    start(async () => {
      const r = await deleteGroup(g.id)
      if (r.error) window.alert(r.error)
      else router.refresh()
    })
  }
  if (!edit) {
    return (
      <h2 className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[16px] font-extrabold">
        {g.name}
        {canRename && <button type="button" onClick={() => setEdit(true)} className="text-[12px] font-normal text-muted underline underline-offset-2">{t('이름 바꾸기', 'Rename')}</button>}
        {canDelete && <button type="button" onClick={remove} disabled={pending} className="text-[12px] font-normal text-danger underline underline-offset-2 disabled:opacity-50">{pending ? t('지우는 중…', 'Deleting…') : t('그룹 삭제', 'Delete group')}</button>}
      </h2>
    )
  }
  return (
    <div className="flex gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} aria-label={t('그룹 이름', 'Group name')} className="field-input min-w-0 flex-1 sm:w-60 sm:flex-none" />
      <button type="button" disabled={pending} onClick={() => start(async () => { const r = await renameGroup(g.id, name); if (!r.error) { setEdit(false); router.refresh() } else window.alert(r.error) })} className="btn-primary px-3 py-1.5">{t('저장', 'Save')}</button>
      <button type="button" onClick={() => setEdit(false)} className="btn-secondary px-3 py-1.5">{t('취소', 'Cancel')}</button>
    </div>
  )
}

export default function GroupOutlets({ groups, outlets, canManage, isSuper = false, myGroupId, currentOutletId }: { groups: Group[]; outlets: Outlet[]; canManage: boolean; isSuper?: boolean; myGroupId: string | null; currentOutletId: string | null }) {
  const t = useT()
  const outletCount = (n: number) => t(`매체 ${n}개`, `${n} ${n === 1 ? 'outlet' : 'outlets'}`)
  const [outletState, outletAction] = useActionState<FormState, FormData>(createOutlet, {})
  const [groupState, groupAction] = useActionState<FormState, FormData>(createGroup, {})
  const orphans = outlets.filter((o) => !o.publisher_id || !groups.some((g) => g.id === o.publisher_id))
  const realGroups = groups.filter((g) => !g.solo)
  const soloIds = new Set(groups.filter((g) => g.solo).map((g) => g.id))
  // 운영팀 화면: 언론사는 대부분 매체 1개를 혼자 운영하므로, 매체가 1개뿐인 그룹은 '개별 매체' 칸에 모아 보인다
  //   (화면만 모을 뿐 그룹은 그대로다. 매체가 여러 개이거나 하나도 없는 그룹은 그룹 칸으로 남는다)
  const countOf = (gid: string) => outlets.filter((o) => o.publisher_id === gid).length
  const singleIds = new Set(canManage ? realGroups.filter((g) => countOf(g.id) === 1).map((g) => g.id) : [])
  const shownGroups = realGroups.filter((g) => !singleIds.has(g.id))
  const soloOutlets = outlets.filter((o) => o.publisher_id && (soloIds.has(o.publisher_id) || singleIds.has(o.publisher_id)))
  const myGroupIsSolo = !!myGroupId && soloIds.has(myGroupId)

  return (
    <div className="space-y-6">
      {canManage && (
      <form action={outletAction} className="rounded-lg border border-line bg-white p-5">
        <h2 className="text-[15px] font-bold">{t('새 매체 만들기', 'Create a new outlet')}</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <input name="name" required placeholder={t('매체 이름 (예: 시니어경제)', 'Outlet name (e.g. Senior Economy)')} aria-label={t('매체 이름', 'Outlet name')} className="field-input w-56" />
          <input name="domain" placeholder={t('도메인 (나중에 넣어도 됩니다)', 'Domain (you can add it later)')} aria-label={t('도메인', 'Domain')} className="field-input w-64" />
          {(
            <select name="publisher_id" defaultValue={myGroupId && !myGroupIsSolo ? myGroupId : isSuper ? SOLO : realGroups[0]?.id ?? SOLO} aria-label={t('그룹', 'Group')} className="field-input w-48">
              {isSuper && <option value={SOLO}>{t('개별 매체 (그룹 없음)', 'Standalone outlet (no group)')}</option>}
              {realGroups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          )}
          <PendingButton pending={t('만드는 중…', 'Creating…')} className="btn-primary">{t('만들기', 'Create')}</PendingButton>
        </div>
        {outletState.error && <p role="alert" className="mt-2 text-[13px] text-danger">{outletState.error}</p>}
        {outletState.ok && <p role="status" className="mt-2 text-[13px] text-published">{outletState.ok}</p>}
      </form>
      )}

      {shownGroups.map((g) => {
        const list = outlets.filter((o) => o.publisher_id === g.id)
        return (
          <section key={g.id} className="rounded-lg border border-line bg-white">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line px-5 py-3.5">
              <GroupName g={g} canRename={canManage} canDelete={isSuper} count={list.length} />
              <span className="text-[12.5px] text-muted">{outletCount(list.length)}</span>
            </div>
            <ul className="divide-y divide-line">
              {list.map((o) => <OutletRow key={o.id} o={o} groups={groups} canManage={canManage} canMove={isSuper} current={o.id === currentOutletId} />)}
              {!list.length && <li className="px-5 py-6 text-center text-[13px] text-muted">{t('아직 매체가 없습니다.', 'No outlets yet.')}</li>}
            </ul>
          </section>
        )
      })}

      {/* 개별 매체: 그룹 없이 혼자 운영하는 매체들 (각자 숨은 그룹이 있어 서로 자료가 섞이지 않는다) */}
      {soloOutlets.length > 0 && (
        <section className="rounded-lg border border-line bg-white">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line px-5 py-3.5">
            <h2 className="text-[16px] font-extrabold">{t('개별 매체', 'Standalone outlets')} <span className="ml-1 text-[12px] font-normal text-muted">{t('그룹 없이 혼자 운영하는 매체', 'Outlets that run on their own without a group')}</span></h2>
            <span className="text-[12.5px] text-muted">{outletCount(soloOutlets.length)}</span>
          </div>
          <ul className="divide-y divide-line">
            {soloOutlets.map((o) => <OutletRow key={o.id} o={o} groups={groups} canManage={canManage} canMove={isSuper} current={o.id === currentOutletId} />)}
          </ul>
        </section>
      )}

      {canManage && orphans.length > 0 && (
        <section className="rounded-lg border border-danger/30 bg-white">
          <p className="border-b border-line px-5 py-3.5 text-[14px] font-bold text-danger">{t('그룹이 없는 매체 — 수정에서 그룹을 정해 주세요', 'Outlets without a group — set a group under Edit')}</p>
          <ul className="divide-y divide-line">
            {orphans.map((o) => <OutletRow key={o.id} o={o} groups={groups} canManage canMove={isSuper} current={o.id === currentOutletId} />)}
          </ul>
        </section>
      )}

      {canManage && (
        <form action={groupAction} className="rounded-lg border border-dashed border-line bg-white p-5">
          <h2 className="text-[15px] font-bold">{t('새 그룹 만들기', 'Create a new group')} <span className="text-[12px] font-normal text-muted">{t('(새 고객 언론사·발행인마다 하나)', '(one per new customer outlet/publisher)')}</span></h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <input name="name" required placeholder={t('그룹 이름 (예: ○○미디어)', 'Group name (e.g. ○○ Media)')} aria-label={t('그룹 이름', 'Group name')} className="field-input w-full sm:w-72" />
            <PendingButton pending={t('만드는 중…', 'Creating…')} className="btn-secondary">{t('그룹 만들기', 'Create group')}</PendingButton>
          </div>
          {groupState.error && <p role="alert" className="mt-2 text-[13px] text-danger">{groupState.error}</p>}
          {groupState.ok && <p role="status" className="mt-2 text-[13px] text-published">{groupState.ok} {t('매체를 만든 뒤 회원 메뉴에서 이 그룹의 발행인을 초대하세요.', 'After creating an outlet, invite this group\'s publisher from the Members menu.')}</p>}
        </form>
      )}
    </div>
  )
}
