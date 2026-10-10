'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { notify } from '@/lib/notify'
import { notifyInvoiceIssued } from '@/lib/invoice-mail'
import { cmsOrigin } from '@/lib/origin'
import { billingItems, billingTargets, type BillingTarget } from '@/lib/billing'
import { planById } from '@/lib/pricing'
import { answerSupportTicket } from '@/lib/ai-support'
import { paymentDbSecret } from '@/lib/toss'
import { ROLE_LABEL, type UserRole } from '@/lib/types'
import { NOTICE_CATEGORIES, TICKET_CATEGORIES, TICKET_STATUS, invoiceTotals, type InvoiceItem } from '@/lib/support'

const text = (form: FormData, k: string, max: number) => String(form.get(k) ?? '').trim().slice(0, max)

// 운영팀(총관리자·매니저): 업무요청 상태, 공지
async function staffContext() {
  const ctx = await getCmsContext()
  if (!ctx.isStaff) redirect('/support')
  return ctx
}

// 청구서 발행·납부 처리는 총관리자만
async function superContext() {
  const ctx = await getCmsContext()
  if (!ctx.isSuper) redirect('/support')
  return ctx
}

// ── 업무요청 ── (첨부파일은 요청이 만들어진 뒤 화면에서 비공개 저장소로 바로 올린다)
export async function createTicket(input: { category: string; title: string; body: string }): Promise<{ id?: string; error?: string }> {
  const { supabase, user, outletId, isStaff, isGroupAdmin, profile } = await getCmsContext()
  const category = input.category in TICKET_CATEGORIES ? input.category : null
  const title = input.title.trim().slice(0, 200)
  const body = input.body.trim().slice(0, 20000)
  if (!category) return { error: '작업 유형을 골라주세요.' }
  if (!title) return { error: '제목을 적어주세요.' }
  if (!body) return { error: '요청 내용을 적어주세요.' }
  const { data, error } = await supabase
    .from('support_tickets').insert({ category, title, body, requester_id: user.id, outlet_id: outletId }).select('id').single()
  if (error || !data) return { error: /support_tickets/.test(error?.message ?? '') && /does not exist|schema cache|not find/i.test(error?.message ?? '') ? '고객센터를 쓰려면 관리자가 support.sql을 실행해야 합니다.' : `요청을 저장하지 못했습니다: ${error?.message ?? ''}` }
  revalidatePath('/support', 'layout')
  // AI 첫 답변: 응답을 먼저 돌려준 뒤 만든다 (요청 화면이 기다리지 않게). 운영팀이 쓴 요청에는 달지 않는다
  //   응답 뒤에는 로그인 쿠키를 읽을 수 없으므로 로그인 없는 연결 + 서버 열쇠로 기록한다
  if (!isStaff && process.env.PAYMENT_DB_SECRET) {
    const id = data.id as string
    const role = isGroupAdmin ? '발행인' : ROLE_LABEL[(profile?.role ?? 'reporter') as UserRole] ?? '기자'
    const { data: o } = outletId ? await supabase.from('outlets').select('name').eq('id', outletId).maybeSingle() : { data: null }
    const outletName = (o as { name?: string } | null)?.name ?? null
    after(async () => {
      const secret = paymentDbSecret()
      const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
      // 실패하면 운영팀이 볼 수 있게 이유를 한 줄 남기고 담당자 차례로 넘긴다
      const giveUp = (why: string) => db.rpc('support_ai_reply', { secret, t: id, p_body: null, p_kind: 'other', p_urgency: 'normal', p_summary: `AI 답변 못 함: ${why}`.slice(0, 280), p_handoff: true })
      try {
        const a = await answerSupportTicket({ category: TICKET_CATEGORIES[category as keyof typeof TICKET_CATEGORIES], title, body, role, outletName })
        if (!a) { await giveUp('AI 키가 설정되지 않았습니다'); return }
        const { error: e } = await db.rpc('support_ai_reply', { secret, t: id, p_body: a.answer || null, p_kind: a.kind, p_urgency: a.urgency, p_summary: a.summary, p_handoff: a.handoff })
        if (e) { console.error('support_ai_reply', e.message); await giveUp(e.message) }
      } catch (e) {
        console.error('support ai', e)
        await giveUp(e instanceof Error ? e.message : '알 수 없는 오류')
      }
    })
  }
  return { id: data.id }
}

// 운영팀 → 회원 한 사람에게 먼저 보내는 안내 (그 사람과 운영팀만 본다, support-ai.sql). 받은 사람에게 알림 메일
export async function sendStaffMessage(to: string, title: string, body: string): Promise<{ id?: string; error?: string }> {
  const { supabase, isStaff } = await getCmsContext()
  if (!isStaff) return { error: '운영팀만 보낼 수 있습니다.' }
  const { data: id, error } = await supabase.rpc('staff_message_to', { target: to, p_title: title.trim().slice(0, 200), p_body: body.trim().slice(0, 20000) })
  if (error || !id) return { error: /staff_message_to/.test(error?.message ?? '') ? '이 기능을 쓰려면 support-ai.sql을 다시 실행해야 합니다.' : `보내지 못했습니다: ${error?.message ?? ''}` }
  const url = `${(await cmsOrigin())}/support/tickets/${id}`
  await notify(supabase, 'ticket_staff_reply', id as string, `staffmsg:${id}`, () => ({
    subject: `[IM 뉴스룸] ${title.trim()}`,
    title: 'IM 뉴스룸 운영팀이 안내를 보냈습니다',
    lines: [`“${title.trim()}”`, body.trim().length > 300 ? `${body.trim().slice(0, 300)}…` : body.trim()],
    button: { label: '고객센터에서 보기', url },
  }))
  revalidatePath('/support', 'layout')
  return { id: id as string }
}

// 업무요청 지우기: 쓴 사람과 총관리자. 첨부파일(비공개 저장소)을 먼저 지우고 요청을 지운다 (답글은 함께 지워진다)
export async function deleteTicket(ticketId: string): Promise<{ error?: string }> {
  const { supabase, user, isSuper } = await getCmsContext()
  const { data: t } = await supabase.from('support_tickets').select('id, requester_id').eq('id', ticketId).maybeSingle()
  if (!t) return { error: '요청을 찾지 못했습니다.' }
  if (t.requester_id !== user.id && !isSuper) return { error: '본인이 쓴 요청만 지울 수 있습니다.' }
  const { data: files } = await supabase.from('support_files').select('path').eq('ticket_id', ticketId)
  const paths = ((files ?? []) as { path: string }[]).map((f) => f.path)
  if (paths.length) await supabase.storage.from('support').remove(paths)
  const { data: gone, error } = await supabase.from('support_tickets').delete().eq('id', ticketId).select('id')
  if (error || !gone?.length) return { error: error?.message ?? '지울 권한이 없습니다. 운영팀이 support-ai.sql을 다시 실행해야 할 수 있습니다.' }
  revalidatePath('/support', 'layout')
  return {}
}

// 요청한 사람: AI 첫 답변으로 해결됐는지 (해결 → 완료, 아니면 담당자 차례)
export async function aiTicketFeedback(ticketId: string, solved: boolean): Promise<{ state?: string; error?: string }> {
  const { supabase } = await getCmsContext()
  const { data, error } = await supabase.rpc('support_ai_feedback', { t: ticketId, solved })
  if (error) return { error: error.message }
  revalidatePath('/support', 'layout')
  return { state: data as string }
}

export async function addReply(ticketId: string, body: string): Promise<{ id?: string; error?: string }> {
  const { supabase, user, isStaff, profile } = await getCmsContext()
  const clean = body.trim().slice(0, 20000)
  if (!clean) return { error: '내용을 적어주세요.' }
  const { data, error } = await supabase.from('support_replies').insert({ ticket_id: ticketId, author_id: user.id, body: clean }).select('id').single()
  if (error || !data) return { error: `답변을 저장하지 못했습니다: ${error?.message ?? ''}` }
  // 알림 메일: 운영팀 답변 → 요청한 사람, 고객 답글 → 담당 매니저
  const { data: t } = await supabase.from('support_tickets').select('title, requester_id').eq('id', ticketId).maybeSingle()
  if (t) {
    const staffReply = isStaff && t.requester_id !== user.id
    const url = `${(await cmsOrigin())}/support/tickets/${ticketId}`
    await notify(supabase, staffReply ? 'ticket_staff_reply' : 'ticket_customer_reply', ticketId, `reply:${data.id}`, () => ({
      subject: staffReply ? `[IM 뉴스룸] 업무요청에 답변이 왔습니다: ${t.title}` : `[업무요청 답글] ${t.title}`,
      title: staffReply ? '업무요청에 답변이 왔습니다' : '업무요청에 답글이 달렸습니다',
      lines: [`“${t.title}”`, `${(profile?.full_name as string | undefined) ?? ''}: ${clean.length > 300 ? `${clean.slice(0, 300)}…` : clean}`],
      button: { label: '고객센터에서 보기', url },
    }))
  }
  revalidatePath(`/support/tickets/${ticketId}`)
  return { id: data.id }
}

export async function setTicketStatus(id: string, status: string) {
  const { supabase } = await staffContext()
  if (!(status in TICKET_STATUS)) return
  await supabase.from('support_tickets')
    .update({ status, updated_at: new Date().toISOString(), done_at: status === 'done' ? new Date().toISOString() : null }).eq('id', id)
  revalidatePath('/support', 'layout')
}

// ── 공지 ──
export type FormState = { error?: string; ok?: boolean }

export async function saveNotice(id: string | null, _prev: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await staffContext()
  const row = {
    category: text(form, 'category', 20) in NOTICE_CATEGORIES ? text(form, 'category', 20) : 'notice',
    title: text(form, 'title', 200),
    body: text(form, 'body', 50000),
    pinned: form.get('pinned') === 'on',
  }
  if (!row.title || !row.body) return { error: '제목과 내용을 적어주세요.' }
  const q = id ? supabase.from('support_notices').update(row).eq('id', id).select('id').single() : supabase.from('support_notices').insert(row).select('id').single()
  const { data, error } = await q
  if (error || !data) return { error: `저장하지 못했습니다: ${error?.message ?? ''}` }
  revalidatePath('/support', 'layout')
  redirect(`/support/notices/${data.id}`)
}

export async function deleteNotice(id: string) {
  const { supabase } = await staffContext()
  await supabase.from('support_notices').delete().eq('id', id)
  revalidatePath('/support', 'layout')
  redirect('/support/notices')
}

// ── 결제 정보 ──
export async function saveBilling(outletId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await getCmsContext()
  const row = {
    outlet_id: outletId,
    company_name: text(form, 'company_name', 100) || null,
    biz_no: text(form, 'biz_no', 20) || null,
    ceo_name: text(form, 'ceo_name', 40) || null,
    address: text(form, 'address', 200) || null,
    manager_name: text(form, 'manager_name', 40) || null,
    manager_email: text(form, 'manager_email', 120) || null,
    manager_phone: text(form, 'manager_phone', 30) || null,
    updated_at: new Date().toISOString(),
  }
  if (row.manager_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.manager_email)) return { error: '담당자 이메일을 확인해 주세요.' }
  const { error } = await supabase.from('outlet_billing').upsert(row)
  if (error) return { error: `저장하지 못했습니다: ${error.message}` }
  revalidatePath('/support', 'layout')
  return { ok: true }
}

// ── 청구서 ──
export async function saveInvoice(_prev: FormState, form: FormData): Promise<FormState> {
  const { supabase } = await superContext()
  const outlet_id = text(form, 'outlet_id', 40)
  const month = text(form, 'month', 7)
  if (!outlet_id) return { error: '매체를 고르세요.' }
  if (!/^\d{4}-\d{2}$/.test(month)) return { error: '청구 월을 고르세요.' }

  const names = form.getAll('item_name').map(String)
  const qtys = form.getAll('item_qty').map(Number)
  const prices = form.getAll('item_price').map((v) => Number(String(v).replace(/[^\d.-]/g, '')))
  const items: InvoiceItem[] = names
    .map((name, i) => ({ name: name.trim().slice(0, 100), qty: qtys[i] || 0, unit_price: prices[i] || 0 }))
    .filter((i) => i.name && i.qty)
  if (!items.length) return { error: '청구 항목을 한 줄 이상 적어주세요.' }
  const t = invoiceTotals(items)

  const { data, error } = await supabase
    .from('invoices')
    .upsert({
      outlet_id, month: `${month}-01`, items, supply_amount: t.supply, vat: t.vat, total: t.total,
      due_date: text(form, 'due_date', 10) || null, memo: text(form, 'memo', 1000) || null,
    }, { onConflict: 'outlet_id,month' })
    .select('id').single()
  if (error || !data) return { error: `저장하지 못했습니다: ${error?.message ?? ''}` }
  await notifyInvoice(supabase, data.id)
  revalidatePath('/support', 'layout')
  redirect(`/support/invoices/${data.id}`)
}

// 청구서 발행 화면: 요금표와 그 매체의 자동 청구 설정(요금제·베타 반값·추가 매체·AI 추가 사용·세팅비)으로 항목을 채운다
//   자동 청구를 켠 매체는 자동 청구와 똑같이, 아니면 요금제·청구 설정만으로 계산한다 (AI 추가 사용은 빠진다)
export async function invoiceDraft(outletId: string, month: string): Promise<{ items: InvoiceItem[]; note: string }> {
  const { supabase } = await superContext()
  if (!/^[0-9a-f-]{36}$/.test(outletId) || !/^\d{4}-\d{2}$/.test(month)) return { items: [], note: '' }
  let target: BillingTarget | null = null
  if (process.env.PAYMENT_DB_SECRET) {
    try {
      target = (await billingTargets(supabase, month)).find((t) => t.outlet_id === outletId) ?? null
    } catch { /* 자동 청구 함수가 없으면 아래에서 직접 계산 */ }
  }
  let partial = false
  if (!target) {
    const [{ data: o }, { data: p }, { data: kids }] = await Promise.all([
      supabase.from('outlets').select('id, name, plan').eq('id', outletId).maybeSingle(),
      supabase.from('outlet_plans').select('*').eq('outlet_id', outletId).maybeSingle(),
      supabase.from('outlet_plans').select('outlet_id, outlet:outlets!outlet_plans_outlet_id_fkey(name)').eq('bill_to', outletId),
    ])
    if (!o) return { items: [], note: '매체를 찾지 못했습니다.' }
    const plan = p as { cycle?: string; beta?: boolean; start_month?: string | null; setup_fee_pending?: boolean; custom_monthly?: number | null; bill_to?: string | null } | null
    if (plan?.bill_to) return { items: [], note: '추가 매체는 청구 받는 매체의 청구서에 함께 들어갑니다. 그 매체를 골라 주세요.' }
    target = {
      outlet_id: o.id, name: o.name, plan: o.plan ?? null,
      cycle: plan?.cycle === 'annual' ? 'annual' : 'monthly', beta: !!plan?.beta, start_month: plan?.start_month ?? null,
      setup_fee_pending: !!plan?.setup_fee_pending, custom_monthly: plan?.custom_monthly ?? null, has_invoice: false,
      over_count: 0, autopay: null,
      children: ((kids ?? []) as unknown as { outlet_id: string; outlet: { name: string } | null }[]).map((k) => ({ outlet_id: k.outlet_id, name: k.outlet?.name ?? '추가 매체', over_count: 0 })),
    }
    partial = true
  }
  const { items } = billingItems(target, month)
  const notes: string[] = []
  if (!planById(target.plan) && target.custom_monthly == null) notes.push('이 매체는 요금제가 정해지지 않았습니다 (AI 사용량 화면에서 정합니다).')
  if (target.cycle === 'annual' && !items.some((i) => i.name.includes('1년'))) notes.push('1년 결제 매체라 이번 달은 이용료 청구 월이 아닙니다.')
  if (partial) notes.push('자동 청구가 꺼진 매체라 지난달 AI 추가 사용은 넣지 않았습니다.')
  return { items, note: notes.join(' ') }
}

export async function setInvoicePaid(id: string, paid: boolean) {
  const { supabase } = await superContext()
  await supabase.from('invoices').update({ status: paid ? 'paid' : 'unpaid', paid_at: paid ? new Date().toISOString() : null }).eq('id', id)
  revalidatePath('/support', 'layout')
}

// 청구서 지우기 (총관리자): 미납이고 실제 결제 기록(시험 결제 제외)이 없을 때만. 시험 결제 기록은 함께 지워진다
export async function deleteInvoice(id: string) {
  const { supabase } = await superContext()
  const { data: inv } = await supabase.from('invoices').select('status').eq('id', id).maybeSingle()
  if (!inv) redirect('/support/invoices')
  const back = (msg: string) => redirect(`/support/invoices/${id}?error=${encodeURIComponent(msg)}`)
  if (inv.status === 'paid') back('납부 완료된 청구서는 지울 수 없습니다. 먼저 “미납으로 되돌리기”를 해 주세요.')
  // payments.sql 전이면 표가 없어 오류 → 결제 기록이 없는 것으로 본다
  const { count, error } = await supabase.from('payments').select('id', { count: 'exact', head: true })
    .eq('invoice_id', id).eq('test_mode', false).in('status', ['done', 'canceled'])
  if (!error && count) back('실제 결제·환불 기록이 있는 청구서는 지울 수 없습니다.')
  const { error: delErr } = await supabase.from('invoices').delete().eq('id', id)
  if (delErr) back(`지우지 못했습니다: ${delErr.message}`)
  revalidatePath('/support', 'layout')
  redirect('/support/invoices')
}

export async function setTicketAssignee(id: string, form: FormData) {
  const { supabase } = await staffContext()
  const assignee = String(form.get('assigned_to') ?? '') || null
  await supabase.from('support_tickets').update({ assigned_to: assignee }).eq('id', id)
  revalidatePath('/support', 'layout')
}

// 청구서 발행 안내 메일 (lib/invoice-mail.ts)
async function notifyInvoice(supabase: Awaited<ReturnType<typeof getCmsContext>>['supabase'], id: string) {
  const { data: inv } = await supabase.from('invoices').select('id, month, total, due_date, created_at, outlet_id, outlet:outlets(name)').eq('id', id).maybeSingle()
  if (!inv) return
  const { data: auto } = await supabase.from('outlet_autopay').select('card_company, card_number').eq('outlet_id', inv.outlet_id).eq('active', true).maybeSingle()
  await notifyInvoiceIssued(supabase, {
    id, outletName: (inv.outlet as unknown as { name: string } | null)?.name ?? '', month: String(inv.month), total: Number(inv.total),
    dueDate: inv.due_date, createdAt: inv.created_at, autopay: auto ?? null, origin: (await cmsOrigin()),
  })
}
