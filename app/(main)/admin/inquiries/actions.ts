'use server'

import { revalidatePath } from 'next/cache'
import { getCmsContext } from '@/lib/cms'
import { mailReady, noticeMail, sendMails } from '@/lib/mail'

// 광고문의 처리 표시·삭제 (편집장 이상, DB 권한이 한 번 더 막는다)
export async function setInquiryStatus(id: string, status: 'new' | 'done') {
  const { supabase, isEditorPlus, isStaff } = await getCmsContext()
  if (!isEditorPlus && !isStaff) return
  await supabase.from('site_inquiries').update({ status }).eq('id', id)
  revalidatePath('/admin/inquiries', 'layout')
}

export async function deleteInquiry(id: string) {
  const { supabase, isEditorPlus, isStaff } = await getCmsContext()
  if (!isEditorPlus && !isStaff) return
  await supabase.from('site_inquiries').delete().eq('id', id)
  revalidatePath('/admin/inquiries', 'layout')
}

export type ReplyState = { ok?: string; error?: string }

// 편집국 안에서 답하기: 문의하신 분께 매체 이름으로 메일을 보내고 기록한다. 그 메일에 다시 답장하면 보낸 편집장에게 온다
export async function replyInquiry(id: string, _prev: ReplyState, form: FormData): Promise<ReplyState> {
  const { supabase, user, isEditorPlus, isStaff } = await getCmsContext()
  if (!isEditorPlus && !isStaff) return { error: '편집장 이상만 답할 수 있습니다.' }
  const body = String(form.get('reply') ?? '').trim().slice(0, 4000)
  if (body.length < 2) return { error: '답변 내용을 적어 주세요.' }
  if (!mailReady()) return { error: '메일 발송이 아직 설정되지 않았습니다. 운영팀에 문의해 주세요.' }
  const { data: q } = await supabase.from('site_inquiries').select('id, outlet_id, name, company, email, body').eq('id', id).maybeSingle()
  if (!q) return { error: '문의를 찾지 못했습니다.' }
  if (!q.email) return { error: '이 문의에는 답변 받을 이메일이 없습니다.' }
  const { data: outlet } = await supabase.from('outlets').select('name').eq('id', q.outlet_id).maybeSingle()
  const outletName = (outlet as { name?: string } | null)?.name ?? '언론사'
  const { html, text } = noticeMail({
    title: `${outletName} 광고문의 답변`,
    lines: [`${q.name ?? ''}님, 안녕하세요. 남겨 주신 광고문의에 답변드립니다.`, body, `— 문의하신 내용: ${String(q.body).slice(0, 300)}${String(q.body).length > 300 ? '…' : ''}`],
    footer: `${outletName} 광고문의 답변 메일입니다. 이 메일에 답장하면 담당자에게 전달됩니다.`,
  })
  const res = await sendMails([{ to: q.email, subject: `[${outletName}] 광고문의 답변드립니다`, html, text, replyTo: user.email ?? null, fromName: outletName, tag: 'inquiry-reply' }])
  if (!res.sent) return { error: '답변 메일을 보내지 못했습니다. 이메일 주소를 확인해 주세요.' }
  await supabase.from('site_inquiries').update({ reply_body: body, replied_at: new Date().toISOString(), replied_by: user.id, status: 'done' }).eq('id', id)
  revalidatePath('/admin/inquiries', 'layout')
  return { ok: '답변을 보냈습니다. 처리 완료로 표시했습니다.' }
}
