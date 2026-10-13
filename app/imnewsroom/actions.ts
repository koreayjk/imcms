'use server'

import { createClient } from '@supabase/supabase-js'
import { BILLING_LABEL, firstPayment, isBeta, planById, type Billing } from '@/lib/pricing'
import { PRIVACY_VERSION, TERMS_VERSION } from '@/lib/service-terms'
import { ISSUER, PRODUCT } from '@/lib/product'
import { noticeMail, sendMails } from '@/lib/mail'
import { quoteUrl } from '@/lib/quote'
import { paymentDbSecret } from '@/lib/toss'

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

  // 광고 봇 거르기: 걸리면 저장하지 않고 '접수됨'처럼 보여 준다 (봇이 다른 방법을 찾지 않게)
  if (looksLikeSpam({ company, contactName, currentCms, phone, email, message })) return { ok: true }

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
  // 서버만 아는 열쇠로 저장 함수를 부른다 (billing-safety-2.sql: 공개 키로는 신청서 표에 바로 넣을 수 없다)
  let error: { message: string } | null = null
  const viaServer = process.env.PAYMENT_DB_SECRET
    ? await supabase.rpc('apply_submit', {
        secret: paymentDbSecret(),
        p: {
          company, contact_name: contactName, phone, email, outlet_count: base.outlet_count ?? '', current_cms: currentCms,
          message, plan: plan.id, billing, domain, terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION,
          quoted_total: pay?.total ?? null, beta_discount: isBeta(),
        },
      })
    : null
  if (!viaServer || (viaServer.error && /apply_submit|function/i.test(viaServer.error.message))) {
    // billing-safety-2.sql 전: 예전처럼 바로 저장
    ;({ error } = await supabase.from('beta_requests').insert({
      ...base, message: message || null, plan: plan.id, billing, domain: domain || null,
      terms_agreed_at: now, terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION, quoted_total: pay?.total ?? null, beta_discount: isBeta(),
    }))
    // legal-billing-safety.sql 전: 개인정보 동의 버전 칸 없이 다시 저장
    if (error && /privacy_version/.test(error.message)) {
      ({ error } = await supabase.from('beta_requests').insert({
        ...base, message: message || null, plan: plan.id, billing, domain: domain || null,
        terms_agreed_at: now, terms_version: TERMS_VERSION, quoted_total: pay?.total ?? null, beta_discount: isBeta(),
      }))
    }
  } else if (viaServer.error) {
    return { error: '신청을 저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.' }
  } else if (viaServer.data == null) {
    // 같은 이메일로 짧은 시간에 여러 번: 이미 받은 신청이 있으니 메일은 다시 보내지 않는다
    return { ok: true }
  }
  if (error) {
    // service-apply.sql 실행 전: 새 칸 없이 저장하고 요금제·도메인·약관 동의는 요청사항 앞에 적어 둔다
    const summary = [
      `[신청] ${plan.name} · ${BILLING_LABEL[billing]}${pay ? ` · 첫 결제 ${pay.total.toLocaleString('ko-KR')}원` : ''}${isBeta() ? ' · 베타 반값' : ''}`,
      domain && `도메인: ${domain}`,
      `이용약관(${TERMS_VERSION}) 동의 ${now}`,
    ].filter(Boolean).join('\n')
    const { error: e2 } = await supabase.from('beta_requests').insert({ ...base, message: `${summary}${message ? `\n\n${message}` : ''}`.slice(0, 2000) })
    if (e2) return { error: '신청을 저장하지 못했습니다. 잠시 뒤 다시 시도해 주세요.' }
  }
  await sendApplyMails({ company, contactName, phone, email, plan: plan.name, planId: plan.id, billing, domain, outletCount, currentCms, message, total: pay?.total ?? null })
  return { ok: true }
}

// 상담 신청 스팸 점수 (3점 이상이면 스팸)
//   예) 'search-imnewsroom.com' 같은 가짜 우리 주소로 "구글 검색 등록해 드립니다"를 보내는 광고 봇
function looksLikeSpam(f: { company: string; contactName: string; currentCms: string; phone: string; email: string; message: string }) {
  const hangul = /[가-힣]/
  const emailDomain = f.email.split('@')[1]?.toLowerCase() ?? ''
  let score = 0
  // 우리 이름을 흉내 낸 주소 (진짜 imnewsroom.com 은 제외)
  if (/imnewsroom/.test(emailDomain) && emailDomain !== 'imnewsroom.com') score += 3
  // 한글이 한 글자도 없다
  if (![f.company, f.contactName, f.currentCms, f.message].some((v) => hangul.test(v))) score += 2
  // 요청사항에 다른 사이트 주소를 넣었다
  if (/https?:\/\/|www\.|\b[a-z0-9-]+\.(?:pro|xyz|top|site|online|info|biz|ru|cn)\b/i.test(f.message)) score += 1
  // 이름·언론사·쓰는 프로그램을 같은 말로 채웠다
  const names = [f.company, f.contactName, f.currentCms].map((v) => v.toLowerCase()).filter(Boolean)
  if (names.length >= 2 && new Set(names).size < names.length) score += 1
  // 광고 문구
  if (/search index|seo|backlink|web search results|rank(ing)? (higher|first)|submit your (site|website)/i.test(f.message)) score += 2
  // 한국 전화번호 모양이 아니다 (0으로 시작하거나 +국가번호)
  const digits = f.phone.replace(/[^\d+]/g, '')
  if (!/^(0\d{8,10}|\+\d{9,14})$/.test(digits)) score += 1
  return score >= 3
}

// 신청 접수 메일: 신청한 분(접수 확인 + 견적서 링크)과 운영팀(새 신청 알림). 메일 설정 전이면 조용히 넘어간다
async function sendApplyMails(a: { company: string; contactName: string; phone: string; email: string; plan: string; planId: string; billing: Billing; domain: string; outletCount: string; currentCms: string; message: string; total: number | null }) {
  const quote = quoteUrl({ plan: a.planId, billing: a.billing, to: a.company })
  const won = a.total != null ? `${a.total.toLocaleString('ko-KR')}원` : '상담 후 안내'
  const toApplicant = noticeMail({
    title: `${a.company} 서비스 신청을 받았습니다`,
    lines: [
      `${a.contactName}님, ${PRODUCT.name}을 신청해 주셔서 감사합니다. 담당자가 영업일 기준 이틀 안에 ${a.phone}으로 연락드려 개통 일정과 계약 내용을 안내합니다.`,
      `신청 내용: ${a.plan} · ${BILLING_LABEL[a.billing]} · 첫 결제 예상 ${won}${a.domain ? ` · 도메인 ${a.domain}` : ''}`,
      '결제는 계약 내용을 확인한 뒤에 진행되며, 신청만으로는 비용이 생기지 않습니다. 아래 버튼으로 이 신청 내용의 견적서를 보고 인쇄(PDF 저장)할 수 있습니다.',
    ],
    button: { label: '견적서 보기', url: quote },
    footer: `이 메일은 ${PRODUCT.name} 서비스 신청 접수 확인입니다. 문의: ${ISSUER.contact ?? ''}`,
  })
  const toStaff = noticeMail({
    title: `새 서비스 신청: ${a.company}`,
    lines: [
      `${a.contactName} · ${a.phone} · ${a.email}`,
      `${a.plan} · ${BILLING_LABEL[a.billing]} · 첫 결제 ${won}`,
      [a.domain && `도메인 ${a.domain}`, a.outletCount && `매체 ${a.outletCount}`, a.currentCms && `지금 프로그램 ${a.currentCms}`].filter(Boolean).join(' · ') || '추가 정보 없음',
      a.message ? `요청사항: ${a.message.slice(0, 500)}` : '요청사항 없음',
      '이틀 안에 연락하기로 안내했습니다.',
    ],
    button: { label: '고객 상담에서 보기', url: `${PRODUCT.appUrl}/admin/leads` },
    footer: '운영팀 알림 메일입니다.',
  })
  const mails = [{ to: a.email, subject: `[${PRODUCT.name}] 서비스 신청 접수 확인`, ...toApplicant, replyTo: ISSUER.contact, tag: 'apply' }]
  if (ISSUER.contact) mails.push({ to: ISSUER.contact, subject: `[새 신청] ${a.company} · ${a.plan}`, ...toStaff, replyTo: a.email, tag: 'apply-staff' })
  await sendMails(mails).catch(() => null)
}
