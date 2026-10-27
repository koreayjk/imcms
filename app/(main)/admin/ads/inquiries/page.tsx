import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import { formatDateTime } from '@/lib/format'
import InquiryReply from '@/components/cms/InquiryReply'
import AdTabs from '@/components/cms/AdTabs'
import { deleteInquiry, setInquiryStatus } from './actions'

type Row = { id: string; name: string | null; company: string | null; phone: string | null; email: string | null; body: string; status: 'new' | 'done'; created_at: string; reply_body: string | null; replied_at: string | null }

// 홈페이지 "광고문의" 양식으로 들어온 문의 (supabase/inquiries.sql). 새 문의는 메일로도 알려 준다
export default async function InquiriesPage() {
  const { supabase, outletId, isEditorPlus, isStaff } = await getCmsContext()
  const { t, lang } = await getT()
  if (!isEditorPlus && !isStaff) redirect('/newsroom')
  if (!outletId) {
    return <div className="mx-auto max-w-[900px] px-4 py-10 md:px-8"><p className="rounded-lg border border-line bg-white px-5 py-4 text-sm">{t('위쪽에서 매체를 먼저 골라 주세요.', 'Choose an outlet at the top first.')}</p></div>
  }
  const { data, error } = await supabase.from('site_inquiries').select('id, name, company, phone, email, body, status, created_at, reply_body, replied_at').eq('outlet_id', outletId).eq('kind', 'ad').order('created_at', { ascending: false }).limit(200)
  const rows = (data ?? []) as Row[]
  const fresh = rows.filter((r) => r.status === 'new').length

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-5 md:px-8 md:py-8">
      <header className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight">{t('광고', 'Ads')}</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">{t('홈페이지 위쪽·아래쪽의 “광고문의”를 누르고 보낸 글입니다. 문의 내용은 여기에서만 보이고, “답하기”로 바로 답할 수 있습니다. 새 문의가 오면 편집장·발행인 메일로 “새 문의가 왔습니다” 알림만 갑니다.', 'These are messages sent through the “Advertise” links at the top and bottom of your homepage. The contents are visible only here, and you can reply right away with “Reply”. When a new inquiry arrives, the Editor-in-Chief and Publisher get an email saying only that a new inquiry has come in.')}</p>
      </header>
      <AdTabs current="inquiries" showContracts />
      {fresh > 0 && <p className="mb-3 text-[13.5px] font-semibold text-danger">{t(`새 문의 ${fresh}건이 있습니다.`, `You have ${fresh} new ${fresh === 1 ? 'inquiry' : 'inquiries'}.`)}</p>}
      {error ? (
        <p className="rounded-lg border border-draft/40 bg-draft/10 px-5 py-4 text-sm">{t('광고문의를 받으려면 Supabase에서', 'To receive ad inquiries, run')} <code>supabase/inquiries.sql</code>{t('을 실행해 주세요.', ' in Supabase.')}</p>
      ) : rows.length === 0 ? (
        <p className="rounded-lg border border-line bg-white px-5 py-8 text-center text-[14px] text-muted">{t('아직 들어온 광고문의가 없습니다.', 'No ad inquiries yet.')}</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className={`rounded-xl border bg-white p-5 ${r.status === 'new' ? 'border-ink/30' : 'border-line'}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={`status-badge px-2 py-0.5 ${r.status === 'new' ? 'bg-danger/10 text-danger' : 'bg-line text-muted'}`}>{r.status === 'new' ? t('새 문의', 'New') : t('처리 완료', 'Handled')}</span>
                <strong className="text-[15px]">{r.company ? `${r.company} · ` : ''}{r.name}</strong>
                <span className="text-[12.5px] tabular-nums text-muted">{formatDateTime(r.created_at, lang)}</span>
              </div>
              <p className="mt-1 text-[13px] text-muted">
                {r.email && <a href={`mailto:${r.email}?subject=${encodeURIComponent(t('[광고문의 답변] ', '[Ad inquiry reply] '))}`} className="underline underline-offset-2">{r.email}</a>}
                {r.phone && <> · <a href={`tel:${r.phone}`} className="underline underline-offset-2">{r.phone}</a></>}
              </p>
              <p className="mt-3 whitespace-pre-wrap text-[14.5px] leading-[1.7]">{r.body}</p>
              {r.replied_at && (
                <div className="mt-3 rounded-lg bg-[#F1F5F9] px-4 py-3 text-[13.5px] leading-relaxed">
                  <p className="text-[12px] font-semibold text-muted">{t('보낸 답변', 'Reply sent')} · {formatDateTime(r.replied_at, lang)}</p>
                  <p className="mt-1 whitespace-pre-wrap">{r.reply_body}</p>
                </div>
              )}
              <div className="mt-4 flex flex-wrap items-start gap-2">
                {r.email && <InquiryReply id={r.id} email={r.email} />}
                <form action={setInquiryStatus.bind(null, r.id, r.status === 'new' ? 'done' : 'new')}>
                  <button type="submit" className="btn-secondary px-3 py-1.5 text-[13px]">{r.status === 'new' ? t('처리 완료로 표시', 'Mark as handled') : t('다시 새 문의로', 'Mark as new')}</button>
                </form>
                <form action={deleteInquiry.bind(null, r.id)}>
                  <button type="submit" className="btn-secondary px-3 py-1.5 text-[13px] text-danger">{t('지우기', 'Delete')}</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
