'use server'

import { createClient } from '@supabase/supabase-js'
import { BETA, BILLING_LABEL, firstPayment, planById, type Billing } from '@/lib/pricing'
import { TERMS_VERSION } from '@/lib/service-terms'

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
  const domain = get('domain', 120).replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase()
  const message = String(form.get('message') ?? '').trim().slice(0, 2000)
  const plan = planById(get('plan', 20))
  const billing: Billing = get('billing', 10) === 'monthly' ? 'monthly' : 'annual'

  if (!plan) return { error: '요금제를 골라 주세요.' }
  if (!company) return { error: '언론사 이름을 적어주세요. 창간 준비 중이면 예정 이름을 적어주세요.' }
  if (!contactName) return { error: '신청하시는 분 이름을 적어주세요.' }
  if (phone.replace(/\D/g, '').length < 9) return { error: '연락받을 전화번호를 확인해 주세요.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: '청구서와 안내를 받을 이메일 주소를 적어주세요.' }
  if (domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return { error: '도메인을 확인해 주세요. 예: mynews.co.kr' }
  if (form.get('agree') !== 'on') return { error: '개인정보 수집·이용에 동의해야 신청할 수 있습니다.' }
  if (form.get('agree_terms') !== 'on') return { error: '서비스 이용약관에 동의해야 신청할 수 있습니다.' }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { error: '지금은 신청을 받을 수 없습니다. 잠시 뒤 다시 시도해 주세요.' }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })

  const now = new Date().toISOString()
  const pay = firstPayment(plan, billing)
  const base = {
    company,
    contact_name: contactName,
    phone,
    email,
    outlet_count: OUTLET_COUNTS.includes(outletCount) ? outletCount : null,
    current_cms: currentCms || null,
    agreed_at: now,
  }
  const { error } = await supabase.from('beta_requests').insert({
    ...base,
    message: message || null,
    plan: plan.id,
    billing,
    domain: domain || null,
    terms_agreed_at: now,
    terms_version: TERMS_VERSION,
    quoted_total: pay?.total ?? null,
    beta_discount: BETA,
  })
  if (error) {
    // service-apply.sql 실행 전: 새 칸 없이 저장하고 요금제·도메인·약관 동의는 요청사항 앞에 적어 둔다
    const summary = [
      `[신청] ${plan.name} · ${BILLING_LABEL[billing]}${pay ? ` · 첫 결제 ${pay.total.toLocaleString('ko-KR')}원` : ''}${BETA ? ' · 베타 반값' : ''}`,
      domain && `도메인: ${domain}`,
      `이용약관(${TERMS_VERSION}) 동의 ${now}`,
    ].filter(Boolean).join('\n')
    const { error: e2 } = await supabase.from('beta_requests').insert({ ...base, message: `${summary}${message ? `\n\n${message}` : ''}`.slice(0, 2000) })
    if (e2) return { error: '신청을 저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.' }
  }
  return { ok: true }
}
