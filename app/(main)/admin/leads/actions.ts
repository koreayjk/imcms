'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { LAUNCH_KEYS, type LaunchDone } from '@/lib/launch-checklist'
import { sendInviteMail } from '@/lib/invite-mail'
import { mailReady, sendMails } from '@/lib/mail'
import { ISSUER, PRODUCT } from '@/lib/product'

const STATUSES = ['new', 'contacted', 'done']
export type LeadState = { error?: string; ok?: string }

async function staffContext() {
  const ctx = await getCmsContext()
  if (!ctx.isStaff) redirect('/newsroom')
  return ctx
}

export async function setLeadStatus(id: string, status: string) {
  const { supabase } = await staffContext()
  if (!STATUSES.includes(status)) return
  await supabase.from('beta_requests').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
  revalidatePath('/', 'layout')
}

// 담당 매니저·상담 기록·상태 저장
export async function saveLead(id: string, input: { status: string; note: string; assignedTo: string | null }): Promise<LeadState> {
  const { supabase } = await staffContext()
  if (!STATUSES.includes(input.status)) return { error: '상태를 확인해 주세요.' }
  const { error } = await supabase
    .from('beta_requests')
    .update({ status: input.status, note: input.note.trim().slice(0, 5000) || null, assigned_to: input.assignedTo, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) return { error: /assigned_to|note/.test(error.message) ? '상담 기록을 저장하려면 staff.sql을 실행해 주세요.' : error.message }
  revalidatePath('/', 'layout')
  return { ok: '저장했습니다.' }
}

const DEFAULT_SECTIONS = [
  { name: '정치', slug: 'politics' },
  { name: '경제', slug: 'economy' },
  { name: '사회', slug: 'society' },
  { name: '문화', slug: 'culture' },
]

// 고객사 개설: 새 그룹 + 첫 매체(기본 섹션) + 발행인 초대 → 상담 완료 처리
export async function openCustomer(leadId: string, _prev: LeadState, form: FormData): Promise<LeadState> {
  const { supabase } = await staffContext()
  const get = (k: string, n: number) => String(form.get(k) ?? '').trim().slice(0, n)
  const groupName = get('group_name', 80)
  const outletName = get('outlet_name', 80)
  const domain = get('domain', 120).replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/^www\./, '').toLowerCase()
  const email = get('email', 120).toLowerCase()
  const fullName = get('full_name', 30)
  if (!groupName || !outletName) return { error: '그룹 이름과 매체 이름을 적어주세요.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: '발행인 이메일을 확인해 주세요.' }
  // 두 번 누름 방지: 이미 고객사를 만든 신청서면 멈춘다
  const { data: already } = await supabase.from('beta_requests').select('publisher_id').eq('id', leadId).maybeSingle()
  if (already?.publisher_id) return { error: '이미 고객사를 만든 신청서입니다. 그룹·매체 관리에서 확인해 주세요.' }

  const { data: group, error: gErr } = await supabase.from('publishers').insert({ name: groupName }).select('id').single()
  if (gErr || !group) return { error: `그룹을 만들지 못했습니다: ${gErr?.message ?? ''}` }
  const { data: outlet, error: oErr } = await supabase
    .from('outlets').insert({ name: outletName, domain: domain || null, publisher_id: group.id, site: { logoMode: 'text', legal: { company: outletName } } })
    .select('id').single()
  if (oErr || !outlet) return { error: `매체를 만들지 못했습니다: ${oErr?.message ?? ''} (그룹은 만들어졌으니 그룹·매체 관리에서 이어서 하세요)` }
  await supabase.from('categories').insert(DEFAULT_SECTIONS.map((c, i) => ({ ...c, outlet_id: outlet.id, sort_order: i + 1 })))
  // 신청서에서 고른 요금제를 새 매체에 넣는다 (ai-usage.sql·service-apply.sql 실행 전이면 조용히 넘어간다)
  const { data: lead } = await supabase.from('beta_requests').select('plan, billing, beta_discount').eq('id', leadId).maybeSingle()
  if (lead?.plan && lead.plan !== 'enterprise') await supabase.from('outlets').update({ plan: lead.plan }).eq('id', outlet.id)
  // 청구 설정: 신청서의 결제 방식·베타 반값·세팅비를 그대로 넘긴다 (billing-auto.sql 전이면 조용히 넘어간다)
  //   자동 청구는 꺼 둔다 → 개통 일정이 정해지면 매체 청구 설정에서 첫 청구 월을 넣고 켠다 (모르는 사이 청구서가 나가지 않게)
  const { error: pErr } = await supabase.from('outlet_plans').upsert({
    outlet_id: outlet.id, auto: false, cycle: lead?.billing === 'monthly' ? 'monthly' : 'annual',
    beta: !!lead?.beta_discount, setup_fee_pending: !lead?.beta_discount, updated_at: new Date().toISOString(),
  })
  const { error: iErr } = await supabase.from('invitations').insert({ email, full_name: fullName || null, role: 'admin', publisher_id: group.id, outlet_id: outlet.id })
  await supabase.from('beta_requests').update({ status: 'done', publisher_id: group.id, updated_at: new Date().toISOString() }).eq('id', leadId)

  revalidatePath('/', 'layout')
  if (iErr) return { ok: `그룹·매체를 만들었습니다. 발행인 초대는 실패했습니다(${iErr.message}) — 회원 메뉴에서 다시 초대하세요.` }
  const mailed = await sendInviteMail({ email, fullName, outletName, role: '발행인' })
  const billingNote = pErr ? ' 청구 설정은 직접 넣어 주세요.' : ' 청구 설정(결제 방식·베타·세팅비)도 넣었습니다. 개통일이 정해지면 첫 청구 월을 넣고 자동 청구를 켜 주세요.'
  return { ok: `‘${groupName}’ 그룹과 ‘${outletName}’ 매체를 만들고 ${email}을 발행인으로 초대했습니다${mailed ? '(초대 메일 보냄)' : ' (메일 설정 전이라 초대 메일은 못 보냈습니다. 가입 주소를 직접 알려 주세요)'}.${billingNote}` }
}

// 무료 체험 5일째 자동 안내 문구 (trial-checkin.sql)
export async function saveAutoMessage(input: { title: string; body: string; enabled: boolean }): Promise<{ error?: string }> {
  const { supabase, user } = await staffContext()
  const title = input.title.trim().slice(0, 200)
  const body = input.body.trim().slice(0, 20000)
  if (!title || !body) return { error: '제목과 내용을 적어 주세요.' }
  const { data, error } = await supabase.from('auto_messages')
    .update({ title, body, enabled: input.enabled, updated_at: new Date().toISOString(), updated_by: user.id })
    .eq('key', 'trial_day5').select('key')
  if (error || !data?.length) return { error: error?.message ?? '저장하지 못했습니다. trial-checkin.sql을 실행했는지 확인해 주세요.' }
  revalidatePath('/admin/leads')
  return {}
}

// 고객사 개통 체크리스트: 항목 하나 체크/해제 (launch-checklist.sql)
export async function setLaunchItem(outletId: string, key: string, done: boolean): Promise<{ done?: LaunchDone; error?: string }> {
  const { supabase, user } = await staffContext()
  if (!LAUNCH_KEYS.includes(key)) return { error: '없는 항목입니다.' }
  const { data: row, error: rErr } = await supabase.from('launch_checklists').select('done').eq('outlet_id', outletId).maybeSingle()
  if (rErr) return { error: /launch_checklists/.test(rErr.message) ? '체크리스트를 쓰려면 launch-checklist.sql을 실행해 주세요.' : rErr.message }
  const next: LaunchDone = { ...((row?.done as LaunchDone | undefined) ?? {}) }
  if (done) next[key] = new Date().toISOString()
  else delete next[key]
  const { error } = await supabase.from('launch_checklists').upsert({ outlet_id: outletId, done: next, updated_at: new Date().toISOString(), updated_by: user.id })
  if (error) return { error: error.message }
  return { done: next }
}

const escHtml = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// 신청 고객에게 안내 메일 보내기: 회신은 contact 주소로 오고, 보낸 기록은 상담 기록에 한 줄 남는다
export async function sendLeadMail(leadId: string, input: { subject: string; body: string }): Promise<LeadState & { note?: string; status?: string }> {
  const { supabase } = await staffContext()
  const subject = input.subject.trim().replace(/[\r\n]+/g, ' ').slice(0, 150)
  const body = input.body.trim().slice(0, 8000)
  if (!subject || !body) return { error: '제목과 내용을 적어 주세요.' }
  if (!mailReady()) return { error: '메일 발송이 아직 설정되지 않았습니다 (RESEND_API_KEY·MAIL_FROM).' }
  const { data: lead } = await supabase.from('beta_requests').select('email, note, status').eq('id', leadId).maybeSingle()
  const to = (lead?.email ?? '').trim()
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { error: '이 신청에는 받는 사람 이메일이 없습니다.' }

  const html = `<!doctype html><html lang="ko"><body style="margin:0;padding:20px;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;font-size:15px;line-height:1.75;color:#14171C"><div style="max-width:600px;white-space:pre-wrap">${escHtml(body)}</div></body></html>`
  const r = await sendMails([{ to, subject, html, text: body, replyTo: ISSUER.contact, fromName: PRODUCT.name, tag: 'lead' }]).catch(() => null)
  if (!r || r.sent < 1) return { error: `메일을 보내지 못했습니다${r?.error ? `: ${r.error}` : ''}` }

  const stamp = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
  const note = [lead?.note?.trim(), `[메일 발송 ${stamp}] ${subject}`].filter(Boolean).join('\n').slice(0, 5000)
  const status = lead?.status === 'new' ? 'contacted' : lead?.status ?? 'contacted'
  await supabase.from('beta_requests').update({ note, status, updated_at: new Date().toISOString() }).eq('id', leadId)
  revalidatePath('/', 'layout')
  return { ok: `${to} 로 보냈습니다. 답장은 ${ISSUER.contact ?? '문의 주소'} 로 옵니다.`, note, status }
}
