'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'

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

  const { data: group, error: gErr } = await supabase.from('publishers').insert({ name: groupName }).select('id').single()
  if (gErr || !group) return { error: `그룹을 만들지 못했습니다: ${gErr?.message ?? ''}` }
  const { data: outlet, error: oErr } = await supabase
    .from('outlets').insert({ name: outletName, domain: domain || null, publisher_id: group.id, site: { logoMode: 'text', legal: { company: outletName } } })
    .select('id').single()
  if (oErr || !outlet) return { error: `매체를 만들지 못했습니다: ${oErr?.message ?? ''} (그룹은 만들어졌으니 그룹·매체 관리에서 이어서 하세요)` }
  await supabase.from('categories').insert(DEFAULT_SECTIONS.map((c, i) => ({ ...c, outlet_id: outlet.id, sort_order: i + 1 })))
  const { error: iErr } = await supabase.from('invitations').insert({ email, full_name: fullName || null, role: 'admin', publisher_id: group.id, outlet_id: outlet.id })
  await supabase.from('beta_requests').update({ status: 'done', publisher_id: group.id, updated_at: new Date().toISOString() }).eq('id', leadId)

  revalidatePath('/', 'layout')
  if (iErr) return { ok: `그룹·매체를 만들었습니다. 발행인 초대는 실패했습니다(${iErr.message}) — 회원 메뉴에서 다시 초대하세요.` }
  return { ok: `‘${groupName}’ 그룹과 ‘${outletName}’ 매체를 만들고 ${email}을 발행인으로 초대했습니다. 이제 홈페이지 설정을 해 주세요.` }
}
