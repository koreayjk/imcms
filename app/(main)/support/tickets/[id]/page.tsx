import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { ticketVisible, viewGroupOutletIds } from '@/lib/view-scope'
import { getT } from '@/lib/cms-t'
import { formatDateTime } from '@/lib/format'
import { type TicketStatus } from '@/lib/support'
import { staffName, ticketCategoryLabel, ticketStatusLabel } from '@/lib/support-i18n'
import PendingButton from '@/components/cms/PendingButton'
import ReplyBox from '@/components/cms/ReplyBox'
import { AiFeedback, AiReplyBody, AiWaiting, DeleteTicketButton, RetryAiButton } from '@/components/cms/SupportAi'
import { SUPPORT_KIND_LABEL, type SupportKind } from '@/lib/support-ai-links'
import { setTicketAssignee, setTicketStatus } from '../../actions'
import BrandMark from '@/components/BrandMark'
import BackLink from '@/components/cms/BackLink'

// 운영팀의 'AI 답변 지금 만들기'가 AI 응답을 기다린다
export const maxDuration = 60

type FileRow = { id: string; reply_id: string | null; path: string; name: string; size: number }

function Files({ files, urls }: { files: FileRow[]; urls: Map<string, string> }) {
  if (!files.length) return null
  // 사진은 화면에 바로 보여 준다 (운영팀 안내의 기능 설명 사진 등)
  const isImg = (n: string) => /\.(png|jpe?g|gif|webp)$/i.test(n)
  const imgs = files.filter((f) => isImg(f.name) && urls.get(f.path))
  const others = files.filter((f) => !imgs.includes(f))
  return (
    <>
    {imgs.length > 0 && (
      <div className="mt-4 space-y-3">
        {imgs.map((f) => (
          <a key={f.id} href={urls.get(f.path)} target="_blank" rel="noopener" className="block overflow-hidden rounded-xl ring-1 ring-black/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={urls.get(f.path)} alt={f.name} className="h-auto w-full" loading="lazy" />
          </a>
        ))}
      </div>
    )}
    {others.length > 0 && <ul className="mt-4 flex flex-wrap gap-2">
      {others.map((f) => (
        <li key={f.id}>
          <a href={urls.get(f.path) ?? '#'} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 break-all rounded border border-line bg-white px-3 py-1.5 text-[12.5px] hover:border-ink">
            📎 {f.name} <span className="text-muted">{Math.max(1, Math.round(f.size / 1024))}KB</span>
          </a>
        </li>
      ))}
    </ul>}
    </>
  )
}

export default async function TicketPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const ctx = await getCmsContext()
  const { supabase, user, isStaff, isSuper } = ctx
  const { t, lang } = await getT()

  const { data: tk } = await supabase
    .from('support_tickets')
    .select('*, requester:profiles!support_tickets_requester_id_fkey(full_name), outlet:outlets(name)')
    .eq('id', params.id)
    .maybeSingle()
  if (!tk || !ticketVisible(tk, ctx, user.id, await viewGroupOutletIds(supabase, ctx))) notFound()

  const [{ data: replies }, { data: files }] = await Promise.all([
    supabase.from('support_replies').select('*, author:profiles!support_replies_author_id_fkey(full_name)').eq('ticket_id', tk.id).order('created_at'),
    supabase.from('support_files').select('id, reply_id, path, name, size').eq('ticket_id', tk.id).order('created_at'),
  ])
  if (!isStaff) await supabase.rpc('mark_ticket_read', { t: tk.id })
  const { data: staffRows } = isStaff ? await supabase.from('profiles').select('id, full_name, is_super, is_staff') : { data: [] }
  const staff = ((staffRows ?? []) as any[]).filter((p) => p.is_super || p.is_staff)

  const fileRows = (files ?? []) as FileRow[]
  const { data: signed } = fileRows.length
    ? await supabase.storage.from('support').createSignedUrls(fileRows.map((f) => f.path), 3600)
    : { data: [] }
  const urls = new Map((signed ?? []).filter((s) => s.signedUrl).map((s) => [s.path as string, s.signedUrl as string]))

  const steps: TicketStatus[] = ['received', 'in_progress', 'done']
  // AI 첫 답변 (support-ai.sql 전이면 칸이 없어 아무것도 보이지 않는다)
  const aiState = (tk as { ai_state?: string | null }).ai_state ?? null
  const hasAi = (replies ?? []).some((r: any) => r.is_ai)
  const aiWaiting = 'ai_state' in tk && !(tk as { from_staff?: boolean }).from_staff && !aiState && !hasAi && tk.status !== 'done' && Date.now() - Date.parse(tk.created_at) < 90_000
  const mine = tk.requester_id === user.id

  return (
    <div className="mx-auto max-w-[860px] px-4 py-6 md:px-8 md:py-10">
      <div className="flex items-center justify-between gap-3">
        <BackLink href="/support/tickets" className="text-[13px] text-muted hover:text-ink">{t('← 업무요청 목록', '← Support requests')}</BackLink>
        {(tk.requester_id === user.id || isSuper) && <DeleteTicketButton ticketId={tk.id} answered={!!replies?.length} />}
      </div>

      <header className="mt-4 border-b border-line pb-6 text-center">
        {(tk as { from_staff?: boolean }).from_staff
          ? <p className="text-[13px] font-semibold text-[#2F6BF0]">{t('IM 뉴스룸 운영팀 안내', 'Message from the IM Newsroom team')}</p>
          : <p className="text-[13px] text-muted">[{ticketCategoryLabel(tk.category, lang)}]</p>}
        <h1 className="mt-1 text-[26px] font-extrabold leading-snug tracking-tight [text-wrap:balance]">{tk.title}</h1>
        <p className="mt-2 text-[13px] text-muted">
          {(tk as { from_staff?: boolean }).from_staff
            ? <>{t('운영팀', 'IM Newsroom team')} → {tk.requester?.full_name} · {formatDateTime(tk.created_at, lang)} · {t('받은 분과 운영팀만 볼 수 있습니다', 'Only the recipient and the team can see this')}</>
            : <>{isStaff && tk.outlet?.name && <>{tk.outlet.name} · </>}{t('요청인', 'Requested by')} {tk.requester?.full_name} · {t('요청일', 'Date')} {formatDateTime(tk.created_at, lang)}</>}
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          {steps.map((s, i) => {
            const active = tk.status === s
            const cls = `rounded-full px-3.5 py-1.5 text-[12.5px] font-bold ${active ? 'bg-ink text-white' : 'bg-line/60 text-muted'}`
            return (
              <span key={s} className="flex items-center gap-2">
                {i > 0 && <span className="h-px w-5 bg-line" />}
                {isStaff && !active ? (
                  <form action={setTicketStatus.bind(null, tk.id, s)}>
                    <PendingButton pending="…" className={`${cls} hover:bg-ink/80 hover:text-white`}>{ticketStatusLabel(s, lang)}</PendingButton>
                  </form>
                ) : (
                  <span className={cls}>{ticketStatusLabel(s, lang)}</span>
                )}
              </span>
            )
          })}
        </div>
        {isStaff && (
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[12.5px]">
            <span className="text-muted">{t('단계를 눌러 상태를 바꿉니다 ·', 'Click a step to change the status ·')}</span>
            <form action={setTicketAssignee.bind(null, tk.id)} className="flex items-center gap-1.5">
              <label htmlFor="assignee" className="text-muted">{t('담당', 'Assignee')}</label>
              <select id="assignee" name="assigned_to" defaultValue={tk.assigned_to ?? ''} className="rounded border border-line bg-white px-2 py-1">
                <option value="">{t('미지정', 'Unassigned')}</option>
                {staff.map((s: any) => <option key={s.id} value={s.id}>{s.full_name}</option>)}
              </select>
              <PendingButton pending="…" className="rounded border border-line bg-white px-2 py-1 hover:border-ink">{t('지정', 'Assign')}</PendingButton>
            </form>
          </div>
        )}
        {isStaff && 'ai_state' in tk && !(tk as { from_staff?: boolean }).from_staff && !hasAi && tk.status !== 'done' && !aiWaiting && (
          <p className="mx-auto mt-3 flex max-w-xl flex-wrap items-center justify-center gap-2 text-[12.5px] text-muted">
            {aiState ? null : <span>{t('AI 첫 답변이 아직 없습니다.', 'There is no AI first reply yet.')}</span>}
            <RetryAiButton ticketId={tk.id} />
          </p>
        )}
        {isStaff && aiState && (
          <p className="mx-auto mt-4 max-w-xl rounded-xl bg-[#F4F6FB] px-4 py-2.5 text-[12.5px] text-[#3B4048]">
            <strong className="text-[#2F6BF0]">{t('AI 분류', 'AI category')}</strong> · {SUPPORT_KIND_LABEL[(tk as any).ai_kind as SupportKind] ?? t('기타', 'Other')}
            {(tk as any).ai_urgency === 'high' && <strong className="text-danger"> · {t('급함', 'Urgent')}</strong>}
            {(tk as any).ai_summary && <> · {(tk as any).ai_summary}</>}
            <span className="ml-1 text-muted">({aiState === 'answered' ? t('AI가 안내함, 요청자 확인 전', 'AI replied, awaiting requester') : aiState === 'handoff' ? t('담당자 답변 필요', 'Needs an agent reply') : aiState === 'resolved' ? t('요청자가 AI 안내로 해결', 'Requester solved it with the AI reply') : t('AI 답변 실패', 'AI reply failed')})</span>
          </p>
        )}
      </header>

      <div className={`whitespace-pre-line break-words text-[15px] leading-[1.85] ${(tk as { from_staff?: boolean }).from_staff ? 'mt-8 rounded-2xl bg-[#EEF2F8] px-6 py-6' : 'py-8'}`}>{tk.body}</div>
      <Files files={fileRows.filter((f) => !f.reply_id)} urls={urls} />

      <div className="mt-10 space-y-4">
        {(replies ?? []).map((r: any) => r.is_ai ? (
          <article key={r.id} className="rounded-2xl bg-[#F4F6FB] p-5 ring-1 ring-[#2F6BF0]/15">
            <header className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#2F6BF0] text-[11px] font-bold text-white">AI</span>
              <strong>{t('AI 안내', 'AI reply')}</strong>
              <span className="rounded bg-[#2F6BF0]/10 px-1.5 py-0.5 text-[11px] font-semibold text-[#2F6BF0]">{t('자동 답변 · 운영팀도 함께 확인합니다', 'Automatic reply · the team reviews it too')}</span>
              <time className="ml-auto text-[12px] tabular-nums text-muted">{formatDateTime(r.created_at, lang)}</time>
            </header>
            <div className="mt-3 whitespace-pre-line break-words rounded-xl bg-white px-5 py-4 text-[14.5px] leading-[1.8]"><AiReplyBody body={r.body} /></div>
            {mine && !isStaff && aiState && tk.status !== 'done' && <AiFeedback ticketId={tk.id} state={aiState} />}
            {aiState === 'resolved' && <p className="mt-3 text-[12.5px] font-semibold text-published">{t('요청자가 이 안내로 해결했다고 표시했습니다.', 'The requester marked this as solved.')}</p>}
          </article>
        ) : (
          <article key={r.id} className={`rounded-2xl p-5 ${r.is_staff ? 'bg-[#EEF2F8]' : 'bg-white ring-1 ring-black/5'}`}>
            <header className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
              {r.is_staff ? <BrandMark size={32} rounded="full" /> : (
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-[12px] font-bold text-white">{(r.author?.full_name ?? '?').slice(0, 1)}</span>
              )}
              <strong>{r.author?.full_name}</strong>
              {r.is_staff && <span className="rounded bg-[#2F6BF0]/10 px-1.5 py-0.5 text-[11px] font-semibold text-[#2F6BF0]">{staffName(lang)}</span>}
              <time className="ml-auto text-[12px] tabular-nums text-muted">{formatDateTime(r.created_at, lang)}</time>
            </header>
            <div className={`mt-3 whitespace-pre-line break-words rounded-xl px-5 py-4 text-[14.5px] leading-[1.8] ${r.is_staff ? 'bg-white' : 'bg-[#F8F9FA]'}`}>{r.body}</div>
            <Files files={fileRows.filter((f) => f.reply_id === r.id)} urls={urls} />
          </article>
        ))}
        {aiWaiting && <AiWaiting />}
        {!replies?.length && !aiWaiting && (
          <p className="rounded-2xl border border-dashed border-line px-5 py-8 text-center text-[13.5px] text-muted">
            {isStaff ? t('아직 답변하지 않은 요청입니다.', 'This request has not been answered yet.') : t('요청이 접수되었습니다. 운영팀이 확인 후 답변드립니다.', 'Your request has been received. The IM Newsroom team will review it and reply.')}
          </p>
        )}
        <ReplyBox ticketId={tk.id} isStaff={isStaff} />
      </div>
    </div>
  )
}
