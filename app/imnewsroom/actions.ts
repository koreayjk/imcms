'use server'

import { createClient } from '@supabase/supabase-js'

export type ApplyState = { ok?: boolean; error?: string }

const OUTLET_COUNTS = ['창간 준비 중', '1개', '2~5개', '6개 이상']

export async function submitBetaRequest(_prev: ApplyState, form: FormData): Promise<ApplyState> {
  // 사람 눈에는 안 보이는 칸: 채워져 있으면 자동 입력 봇이다
  if (String(form.get('website') ?? '')) return { ok: true }

  const get = (k: string, max: number) => String(form.get(k) ?? '').trim().replace(/\s+/g, ' ').slice(0, max)
  const company = get('company', 80)
  const contactName = get('contact_name', 40)
  const phone = get('phone', 30)
  const email = get('email', 120)
  const outletCount = get('outlet_count', 20)
  const currentCms = get('current_cms', 80)
  const message = String(form.get('message') ?? '').trim().slice(0, 2000)

  if (!company) return { error: '언론사 이름을 적어주세요. 창간 준비 중이면 예정 이름을 적어주세요.' }
  if (!contactName) return { error: '담당자 이름을 적어주세요.' }
  if (phone.replace(/\D/g, '').length < 9) return { error: '연락받을 전화번호를 확인해 주세요.' }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: '이메일 주소를 확인해 주세요.' }
  if (form.get('agree') !== 'on') return { error: '개인정보 수집·이용에 동의해야 신청할 수 있습니다.' }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { error: '지금은 신청을 받을 수 없습니다. 잠시 뒤 다시 시도해 주세요.' }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  const { error } = await supabase.from('beta_requests').insert({
    company,
    contact_name: contactName,
    phone,
    email: email || null,
    outlet_count: OUTLET_COUNTS.includes(outletCount) ? outletCount : null,
    current_cms: currentCms || null,
    message: message || null,
    agreed_at: new Date().toISOString(),
  })
  if (error) return { error: '신청을 저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.' }
  return { ok: true }
}
