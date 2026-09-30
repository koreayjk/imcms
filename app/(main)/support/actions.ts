'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { NOTICE_CATEGORIES, TICKET_CATEGORIES, TICKET_STATUS, invoiceTotals, type InvoiceItem } from '@/lib/support'

const text = (form: FormData, k: string, max: number) => String(form.get(k) ?? '').trim().slice(0, max)

async function staffContext() {
  const ctx = await getCmsContext()
  if (ctx.profile?.role !== 'admin') redirect('/support')
  return ctx
}

// ── 업무요청 ── (첨부파일은 요청이 만들어진 뒤 화면에서 비공개 저장소로 바로 올린다)
export async function createTicket(input: { category: string; title: string; body: string }): Promise<{ id?: string; error?: string }> {
  const { supabase, user, outletId } = await getCmsContext()
  const category = input.category in TICKET_CATEGORIES ? input.category : null
  const title = input.title.trim().slice(0, 200)
  const body = input.body.trim().slice(0, 20000)
  if (!category) return { error: '작업 유형을 골라주세요.' }
  if (!title) return { error: '제목을 적어주세요.' }
  if (!body) return { error: '요청 내용을 적어주세요.' }
  const { data, error } = await supabase
    .from('support_tickets').insert({ category, title, body, requester_id: user.id, outlet_id: outletId }).select('id').single()
  if (error || !data) return { error: /support_tickets/.test(error?.message ?? '') ? '고객센터를 쓰려면 관리자가 support.sql을 실행해야 합니다.' : `요청을 저장하지 못했습니다: ${error?.message ?? ''}` }
  revalidatePath('/support', 'layout')
  return { id: data.id }
}

export async function addReply(ticketId: string, body: string): Promise<{ id?: string; error?: string }> {
  const { supabase, user } = await getCmsContext()
  const clean = body.trim().slice(0, 20000)
  if (!clean) return { error: '내용을 적어주세요.' }
  const { data, error } = await supabase.from('support_replies').insert({ ticket_id: ticketId, author_id: user.id, body: clean }).select('id').single()
  if (error || !data) return { error: `답변을 저장하지 못했습니다: ${error?.message ?? ''}` }
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
  const { supabase } = await staffContext()
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
  revalidatePath('/support', 'layout')
  redirect(`/support/invoices/${data.id}`)
}

export async function setInvoicePaid(id: string, paid: boolean) {
  const { supabase } = await staffContext()
  await supabase.from('invoices').update({ status: paid ? 'paid' : 'unpaid', paid_at: paid ? new Date().toISOString() : null }).eq('id', id)
  revalidatePath('/support', 'layout')
}
