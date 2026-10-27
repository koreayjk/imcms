'use client'

import { useEffect, useRef, useState, useTransition, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import { useCmsLang, useT } from '@/components/cms/CmsLang'
import { addMemberOutlet, deletePost, removeMemberOutlet, savePost, setMemberStatus, type FormState } from '@/app/(main)/admin/association/actions'
import PendingButton from './PendingButton'

type Member = { user_id: string; email: string; name: string; phone: string | null; org: string | null; position: string | null; member_type: 'individual' | 'outlet'; status: 'pending' | 'approved' | 'rejected'; marketing: boolean; created: string }
type Post = { id: string; board: 'notice' | 'activity' | 'data'; title: string; body: string; pinned: boolean; published: boolean; created: string; boardLabel: string }
type Outlet = { id: string; name: string; domain: string | null }
type Props = { tab: 'members' | 'posts' | 'outlets'; members: Member[]; posts: Post[]; memberOutletIds: string[]; outlets: Outlet[] }

const STATUS: Record<'ko' | 'en', Record<Member['status'], [string, string]>> = {
  ko: {
    pending: ['승인 대기', 'bg-[#F2B544]/25 text-[#6B4A00]'],
    approved: ['승인', 'bg-[#1E7D4D]/12 text-[#1E5E3D]'],
    rejected: ['보류', 'bg-danger/10 text-danger'],
  },
  en: {
    pending: ['Pending', 'bg-[#F2B544]/25 text-[#6B4A00]'],
    approved: ['Approved', 'bg-[#1E7D4D]/12 text-[#1E5E3D]'],
    rejected: ['On hold', 'bg-danger/10 text-danger'],
  },
}

function Msg({ s }: { s: FormState }) {
  if (s.error) return <p role="alert" className="text-[13px] text-danger">{s.error}</p>
  if (s.ok) return <p role="status" className="text-[13px] text-[#1E5E3D]">{s.ok}</p>
  return null
}

// 회원 승인: 대기 → 승인/보류
function Members({ members }: { members: Member[] }) {
  const t = useT()
  const lang = useCmsLang()
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<FormState>({})
  const [filter, setFilter] = useState<'all' | Member['status']>('all')
  const set = (id: string, s: Member['status']) => start(async () => {
    const r = await setMemberStatus(id, s)
    setMsg(r)
    if (!r.error) router.refresh()
  })
  const shown = filter === 'all' ? members : members.filter((m) => m.status === filter)
  const count = (s: Member['status']) => members.filter((m) => m.status === s).length

  return (
    <section className="mt-5">
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        {([['all', `${t('전체', 'All')} ${members.length}`], ['pending', `${t('승인 대기', 'Pending')} ${count('pending')}`], ['approved', `${t('승인', 'Approved')} ${count('approved')}`], ['rejected', `${t('보류', 'On hold')} ${count('rejected')}`]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k}
            className={`rounded-full border px-3 py-1 ${filter === k ? 'border-ink bg-ink text-white' : 'border-line text-muted hover:text-ink'}`}>{l}</button>
        ))}
        <span className="ml-auto"><Msg s={msg} /></span>
      </div>
      {shown.length ? (
        <ul className="mt-4 divide-y divide-line rounded-lg border border-line bg-white">
          {shown.map((m) => (
            <li key={m.user_id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
              <div className="min-w-[12rem] flex-1">
                <p className="font-bold">
                  {m.name}
                  <span className={`ml-2 rounded px-1.5 py-0.5 text-[11px] font-semibold ${STATUS[lang][m.status][1]}`}>{STATUS[lang][m.status][0]}</span>
                  <span className="ml-1.5 rounded bg-paper px-1.5 py-0.5 text-[11px] text-muted">{m.member_type === 'outlet' ? t('회원사 신청', 'Outlet applicant') : t('개인회원', 'Individual member')}</span>
                </p>
                <p className="mt-0.5 break-words text-[12.5px] text-muted">
                  {m.email}{m.phone ? ` · ${m.phone}` : ''}{m.org ? ` · ${m.org}` : ''}{m.position ? ` ${m.position}` : ''} · {t('가입', 'Joined')} {m.created}{m.marketing ? ` · ${t('소식 수신 동의', 'Agreed to receive news')}` : ''}
                </p>
              </div>
              <div className="flex gap-1.5">
                {m.status !== 'approved' && <button type="button" disabled={pending} onClick={() => set(m.user_id, 'approved')} className="btn-primary px-3 py-1.5">{t('승인', 'Approve')}</button>}
                {m.status !== 'rejected' && <button type="button" disabled={pending} onClick={() => set(m.user_id, 'rejected')} className="btn-secondary px-3 py-1.5">{t('보류', 'Hold')}</button>}
                {m.status !== 'pending' && <button type="button" disabled={pending} onClick={() => set(m.user_id, 'pending')} className="btn-secondary px-3 py-1.5">{t('대기로', 'Set to pending')}</button>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 rounded-lg border border-dashed border-line py-12 text-center text-[14px] text-muted">
          {members.length ? t('해당하는 회원이 없습니다.', 'No matching members.') : t('아직 협회 홈페이지로 가입한 회원이 없습니다.', 'No one has joined through the association website yet.')}
        </p>
      )}
    </section>
  )
}

// 게시글: 공지사항 · 협회 활동 · 자료실
function PostForm({ post, onDone }: { post: Post | null; onDone: () => void }) {
  const t = useT()
  const router = useRouter()
  const [state, action] = useActionState(savePost, {} as FormState)
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (state.ok) {
      router.refresh()
      if (!post && formRef.current) {
        formRef.current.dataset.allowReset = '1'
        formRef.current.reset()
      }
      else onDone()
    }
  }, [state, post, onDone, router])

  return (
    <form ref={formRef} action={action} key={post?.id ?? 'new'} className="space-y-3 rounded-lg border border-line bg-white p-5">
      <p className="text-[15px] font-bold">{post ? t('글 고치기', 'Edit post') : t('새 글 쓰기', 'New post')}</p>
      {post && <input type="hidden" name="id" value={post.id} />}
      <div className="flex flex-wrap gap-2">
        <select name="board" defaultValue={post?.board ?? 'notice'} aria-label={t('게시판', 'Board')} className="field-input w-36">
          <option value="notice">{t('공지사항', 'Announcements')}</option>
          <option value="activity">{t('협회 활동', 'Activities')}</option>
          <option value="data">{t('자료실', 'Resources')}</option>
        </select>
        <input name="title" required maxLength={200} defaultValue={post?.title} placeholder={t('제목', 'Title')} aria-label={t('제목', 'Title')} className="field-input min-w-[12rem] flex-1" />
      </div>
      <textarea name="body" rows={8} defaultValue={post?.body} placeholder={t('본문 (빈 줄로 문단을 나눕니다. 링크는 주소를 그대로 적으면 됩니다)', 'Body (separate paragraphs with a blank line; paste a URL as-is to add a link)')} aria-label={t('본문', 'Body')} className="field-input w-full leading-[1.7]" />
      <div className="flex flex-wrap items-center gap-4 text-[13.5px]">
        <label className="flex items-center gap-1.5"><input type="checkbox" name="pinned" defaultChecked={post?.pinned} /> {t('상단 고정', 'Pin to top')}</label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="published" value="on" defaultChecked={post?.published ?? true} />
          {t('공개', 'Public')}
        </label>
        {/* 체크하면 'on'이 먼저 넘어가고, 끄면 이 'off'만 넘어간다 */}
        <input type="hidden" name="published" value="off" />
        <span className="flex-1"><Msg s={state} /></span>
        {post && <button type="button" onClick={onDone} className="btn-secondary px-3 py-1.5">{t('취소', 'Cancel')}</button>}
        <PendingButton pending={t('저장 중…', 'Saving…')} className="btn-primary px-4 py-1.5">{post ? t('저장', 'Save') : t('올리기', 'Post')}</PendingButton>
      </div>
    </form>
  )
}

function Posts({ posts }: { posts: Post[] }) {
  const t = useT()
  const router = useRouter()
  const [editing, setEditing] = useState<Post | null>(null)
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<FormState>({})
  const remove = (p: Post) => {
    if (!confirm(t(`“${p.title}” 글을 지울까요?`, `Delete the post “${p.title}”?`))) return
    start(async () => {
      const r = await deletePost(p.id)
      setMsg(r)
      if (!r.error) { if (editing?.id === p.id) setEditing(null); router.refresh() }
    })
  }

  return (
    <section className="mt-5 space-y-5">
      <PostForm key={editing?.id ?? 'new'} post={editing} onDone={() => setEditing(null)} />
      <Msg s={msg} />
      {posts.length ? (
        <ul className="divide-y divide-line rounded-lg border border-line bg-white">
          {posts.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className="w-20 shrink-0 text-[12.5px] text-muted">{p.boardLabel}</span>
              <p className="min-w-[10rem] flex-1 truncate font-semibold">
                {p.pinned && <span className="mr-1.5 rounded bg-ink px-1.5 py-0.5 text-[10.5px] text-white">{t('고정', 'Pinned')}</span>}
                {!p.published && <span className="mr-1.5 rounded bg-paper px-1.5 py-0.5 text-[10.5px] text-muted">{t('비공개', 'Private')}</span>}
                {p.title}
              </p>
              <span className="text-[12px] tabular-nums text-muted">{p.created}</span>
              <div className="flex gap-1.5">
                <button type="button" onClick={() => { setEditing(p); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="btn-secondary px-3 py-1">{t('고치기', 'Edit')}</button>
                <button type="button" disabled={pending} onClick={() => remove(p)} className="btn-secondary px-3 py-1 text-danger">{t('지우기', 'Delete')}</button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-line py-12 text-center text-[14px] text-muted">{t('아직 올린 글이 없습니다.', 'No posts yet.')}</p>
      )}
    </section>
  )
}

// 회원사: IM 뉴스룸 매체 중 협회 회원사로 보일 매체
function Outlets({ memberOutletIds, outlets }: { memberOutletIds: string[]; outlets: Outlet[] }) {
  const t = useT()
  const router = useRouter()
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<FormState>({})
  const [pick, setPick] = useState('')
  const byId = new Map(outlets.map((o) => [o.id, o]))
  const members = memberOutletIds.map((id) => byId.get(id)).filter(Boolean) as Outlet[]
  const others = outlets.filter((o) => !memberOutletIds.includes(o.id))
  const run = (f: () => Promise<FormState>) => start(async () => {
    const r = await f()
    setMsg(r)
    if (!r.error) { setPick(''); router.refresh() }
  })

  return (
    <section className="mt-5 space-y-4">
      <p className="text-[13px] text-muted">{t('회원사는 협회 홈페이지의 회원사 목록에 나오고, 발행한 기사가 ‘회원사 뉴스’에 모입니다.', 'Member outlets appear in the member list on the association website, and the stories they publish are gathered under “Member News”.')}</p>
      <ul className="divide-y divide-line rounded-lg border border-line bg-white">
        {members.map((o, i) => (
          <li key={o.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
            <span className="w-6 text-[12px] tabular-nums text-muted">{i + 1}</span>
            <div className="min-w-[10rem] flex-1">
              <p className="font-bold">{o.name}</p>
              <p className="break-all text-[12.5px] text-muted">{o.domain ?? t('도메인 미연결 (홈페이지 링크가 걸리지 않습니다)', 'No domain connected (the website link will not work)')}</p>
            </div>
            <button type="button" disabled={pending} onClick={() => { if (confirm(t(`${o.name}을(를) 회원사에서 뺄까요?`, `Remove ${o.name} from member outlets?`))) run(() => removeMemberOutlet(o.id)) }} className="btn-secondary px-3 py-1.5">{t('회원사에서 빼기', 'Remove from members')}</button>
          </li>
        ))}
        {!members.length && <li className="px-5 py-10 text-center text-[14px] text-muted">{t('회원사가 없습니다.', 'No member outlets.')}</li>}
      </ul>
      {others.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <select value={pick} onChange={(e) => setPick(e.target.value)} aria-label={t('회원사로 넣을 매체', 'Outlet to add as a member')} className="field-input w-64">
            <option value="">{t('매체 고르기', 'Choose an outlet')}</option>
            {others.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <button type="button" disabled={!pick || pending} onClick={() => run(() => addMemberOutlet(pick))} className="btn-primary px-4 py-1.5">{t('회원사로 넣기', 'Add as member')}</button>
        </div>
      )}
      <Msg s={msg} />
    </section>
  )
}

export default function AssociationAdmin({ tab, members, posts, memberOutletIds, outlets }: Props) {
  if (tab === 'posts') return <Posts posts={posts} />
  if (tab === 'outlets') return <Outlets memberOutletIds={memberOutletIds} outlets={outlets} />
  return <Members members={members} />
}
