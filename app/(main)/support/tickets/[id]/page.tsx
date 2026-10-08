import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { formatDateTime } from '@/lib/format'
import { STAFF_NAME, TICKET_CATEGORIES, TICKET_STATUS, type TicketCategory, type TicketStatus } from '@/lib/support'
import PendingButton from '@/components/cms/PendingButton'
import ReplyBox from '@/components/cms/ReplyBox'
import { AiFeedback, AiReplyBody, AiWaiting } from '@/components/cms/SupportAi'
import { SUPPORT_KIND_LABEL, type SupportKind } from '@/lib/support-ai-links'
import { setTicketAssignee, setTicketStatus } from '../../actions'

type FileRow = { id: string; reply_id: string | null; path: string; name: string; size: number }

function Files({ files, urls }: { files: FileRow[]; urls: Map<string, string> }) {
  if (!files.length) return null
  return (
    <ul className="mt-4 flex flex-wrap gap-2">
      {files.map((f) => (
        <li key={f.id}>
          <a href={urls.get(f.path) ?? '#'} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded border border-line bg-white px-3 py-1.5 text-[12.5px] hover:border-ink">
            📎 {f.name} <span className="text-muted">{Math.max(1, Math.round(f.size / 1024))}KB</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

export default async function TicketPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const { supabase, user, isStaff } = await getCmsContext()

  const { data: t } = await supabase
    .from('support_tickets')
    .select('*, requester:profiles!support_tickets_requester_id_fkey(full_name), outlet:outlets(name)')
    .eq('id', params.id)
    .maybeSingle()
  if (!t) notFound()

  const [{ data: replies }, { data: files }] = await Promise.all([
    supabase.from('support_replies').select('*, author:profiles!support_replies_author_id_fkey(full_name)').eq('ticket_id', t.id).order('created_at'),
    supabase.from('support_files').select('id, reply_id, path, name, size').eq('ticket_id', t.id).order('created_at'),
  ])
  if (!isStaff) await supabase.rpc('mark_ticket_read', { t: t.id })
  const { data: staffRows } = isStaff ? await supabase.from('profiles').select('id, full_name, is_super, is_staff') : { data: [] }
  const staff = ((staffRows ?? []) as any[]).filter((p) => p.is_super || p.is_staff)

  const fileRows = (files ?? []) as FileRow[]
  const { data: signed } = fileRows.length
    ? await supabase.storage.from('support').createSignedUrls(fileRows.map((f) => f.path), 3600)
    : { data: [] }
  const urls = new Map((signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path as string, s.signedUrl as string]))

  const steps: TicketStatus[] = ['received', 'in_progress', 'done']
  // AI 첫 답변 (support-ai.sql 전이면 칸이 없어 아무것도 보이지 않는다)
  const aiState = (t as { ai_state?: string | null }).ai_state ?? null
  const hasAi = (replies ?? []).some((r: any) => r.is_ai)
  const aiWaiting = 'ai_state' in t && !aiState && !hasAi && t.status !== 'done' && Date.now() - Date.parse(t.created_at) < 90_000
  const mine = t.requester_id === user.id

  return (
    <div className="mx-auto max-w-[860px] px-4 py-6 md:px-8 md:py-10">
      <Link href="/support/tickets" className="text-[13px] text-muted hover:text-ink">← 업무요청 목록</Link>

      <header className="mt-4 border-b border-line pb-6 text-center">
        <p className="text-[13px] text-muted">[{TICKET_CATEGORIES[t.category as TicketCategory]}]</p>
        <h1 className="mt-1 text-[26px] font-extrabold leading-snug tracking-tight [text-wrap:balance]">{t.title}</h1>
        <p className="mt-2 text-[13px] text-muted">
          {isStaff && t.outlet?.name && <>{t.outlet.name} · </>}요청인 {t.requester?.full_name} · 요청일 {formatDateTime(t.created_at)}
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          {steps.map((s, i) => {
            const active = t.status === s
            const cls = `rounded-full px-3.5 py-1.5 text-[12.5px] font-bold ${active ? 'bg-ink text-white' : 'bg-line/60 text-muted'}`
            return (
              <span key={s} className="flex items-center gap-2">
                {i > 0 && <span className="h-px w-5 bg-line" />}
                {isStaff && !active ? (
                  <form action={setTicketStatus.bind(null, t.id, s)}>
                    <PendingButton pending="…" className={`${cls} hover:bg-ink/80 hover:text-white`}>{TICKET_STATUS[s].label}</PendingButton>
                  </form>
                ) : (
                  <span className={cls}>{TICKET_STATUS[s].label}</span>
                )}
              </span>
            )
          })}
        </div>
        {isStaff && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[12.5px]">
            <span className="text-muted">단계를 눌러 상태를 바꿉니다 ·</span>
            <form action={setTicketAssignee.bind(null, t.id)} className="flex items-center gap-1.5">
              <label htmlFor="assignee" className="text-muted">담당</label>
              <select id="assignee" name="assigned_to" defaultValue={t.assigned_to ?? ''} className="rounded border border-line bg-white px-2 py-1">
                <option value="">미지정</option>
                {staff.map((s: any) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
              <PendingButton pending="…" className="rounded border border-line bg-white px-2 py-1 hover:border-ink">지정</PendingButton>
            </form>
          </div>
        )}
        {isStaff && aiState && (
          <p className="mx-auto mt-4 max-w-xl rounded-xl bg-[#F4F6FB] px-4 py-2.5 text-[12.5px] text-[#3B4048]">
            <strong className="text-[#2F6BF0]">AI 분류</strong> · {SUPPORT_KIND_LABEL[(t as any).ai_kind as SupportKind] ?? '기타'}
            {(t as any).ai_urgency === 'high' && <strong className="text-danger"> · 급함</strong>}
            {(t as any).ai_summary && <> · {(t as any).ai_summary}</>}
            <span className="ml-1 text-muted">({aiState === 'answered' ? 'AI가 안내함, 요청자 확인 전' : aiState === 'handoff' ? '담당자 답변 필요' : aiState === 'resolved' ? '요청자가 AI 안내로 해결' : 'AI 답변 실패'})</span>
          </p>
        )}
      </header>

      <div className="whitespace-pre-line py-8 text-[15px] leading-[1.85]">{t.body}</div>
      <Files files={fileRows.filter((f) => !f.reply_id)} urls={urls} />

      <div className="mt-10 space-y-4">
        {(replies ?? []).map((r: any) => r.is_ai ? (
          <article key={r.id} className="rounded-2xl bg-[#F4F6FB] p-5 ring-1 ring-[#2F6BF0]/15">
            <header className="flex items-center gap-2 text-[13px]">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#2F6BF0] text-[11px] font-bold text-white">AI</span>
              <strong>AI 안내</strong>
              <span className="rounded bg-[#2F6BF0]/10 px-1.5 py-0.5 text-[11px] font-semibold text-[#2F6BF0]">자동 답변 · 운영팀도 함께 확인합니다</span>
              <time className="ml-auto text-[12px] tabular-nums text-muted">{formatDateTime(r.created_at)}</time>
            </header>
            <div className="mt-3 whitespace-pre-line rounded-xl bg-white px-5 py-4 text-[14.5px] leading-[1.8]"><AiReplyBody body={r.body} /></div>
            {mine && !isStaff && aiState && t.status !== 'done' && <AiFeedback ticketId={t.id} state={aiState} />}
            {aiState === 'resolved' && <p className="mt-3 text-[12.5px] font-semibold text-published">요청자가 이 안내로 해결했다고 표시했습니다.</p>}
          </article>
        ) : (
          <article key={r.id} className={`rounded-2xl p-5 ${r.is_staff ? 'bg-[#EEF2F8]' : 'bg-white ring-1 ring-black/5'}`}>
            <header className="flex items-center gap-2 text-[13px]">
              <span className={`grid h-8 w-8 place-items-center rounded-full text-[12px] font-bold text-white ${r.is_staff ? 'bg-gradient-to-br from-[#F5B83D] to-[#E5483A]' : 'bg-muted'}`}>
                {r.is_staff ? 'IM' : (r.author?.full_name ?? '?').slice(0, 1)}
              </span>
              <strong>{r.author?.full_name}</strong>
              {r.is_staff && <span className="rounded bg-[#2F6BF0]/10 px-1.5 py-0.5 text-[11px] font-semibold text-[#2F6BF0]">{STAFF_NAME}</span>}
              <time className="ml-auto text-[12px] tabular-nums text-muted">{formatDateTime(r.created_at)}</time>
            </header>
            <div className={`mt-3 whitespace-pre-line rounded-xl px-5 py-4 text-[14.5px] leading-[1.8] ${r.is_staff ? 'bg-white' : 'bg-[#F8F9FA]'}`}>{r.body}</div>
            <Files files={fileRows.filter((f) => f.reply_id === r.id)} urls={urls} />
          </article>
        ))}
        {aiWaiting && <AiWaiting />}
        {!replies?.length && !aiWaiting && (
          <p className="rounded-2xl border border-dashed border-line px-5 py-8 text-center text-[13.5px] text-muted">
            {isStaff ? '아직 답변하지 않은 요청입니다.' : '요청이 접수되었습니다. 운영팀이 확인 후 답변드립니다.'}
          </p>
        )}
        <ReplyBox ticketId={t.id} isStaff={isStaff} />
      </div>
    </div>
  )
}
