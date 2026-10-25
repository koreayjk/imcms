'use server'

import { createClient } from '@supabase/supabase-js'
import { currentSite } from '@/lib/public-data'
import { mailReady, noticeMail, sendMails } from '@/lib/mail'
import { cmsOrigin } from '@/lib/origin'
import { paymentDbSecret } from '@/lib/toss'

export type InquiryState = { ok?: boolean; error?: string }

const anon = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
const cut = (v: FormDataEntryValue | null, n: number) => String(v ?? '').trim().slice(0, n)

// 홈페이지 광고문의 → 매체별로 저장하고 그 매체 편집장·발행인에게 알림 메일 (supabase/inquiries.sql)
export async function submitAdInquiry(_prev: InquiryState, form: FormData): Promise<InquiryState> {
  if (cut(form.get('website'), 100)) return { ok: true } // 봇
  const site = await currentSite()
  const en = site.lang === 'en'
  const name = cut(form.get('name'), 60)
  const company = cut(form.get('company'), 100)
  const phone = cut(form.get('phone'), 40)
  const email = cut(form.get('email'), 200)
  const body = cut(form.get('body'), 4000)
  if (!name) return { error: en ? 'Please enter your name.' : '성함을 적어 주세요.' }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: en ? 'Please check your email address.' : '답변 받을 이메일 주소를 확인해 주세요.' }
  if (body.length < 5) return { error: en ? 'Please write your inquiry.' : '문의 내용을 적어 주세요.' }
  if (form.get('agree') !== 'on') return { error: en ? 'Please agree to the collection of your information.' : '개인정보 수집·이용에 동의해 주세요.' }
  if (!site.outletId || !process.env.PAYMENT_DB_SECRET) return { error: en ? 'Inquiries are not available yet.' : '문의 접수가 아직 준비되지 않았습니다.' }

  const { data, error } = await anon().rpc('inquiry_submit', { secret: paymentDbSecret(), o: site.outletId, p_kind: 'ad', p_name: name, p_company: company, p_phone: phone, p_email: email, p_body: body })
  if (error) {
    if (/too many/i.test(error.message)) return { error: en ? 'Too many requests. Please try again later.' : '짧은 시간에 너무 많이 보내셨습니다. 잠시 뒤 다시 시도해 주세요.' }
    return { error: en ? 'We could not receive your inquiry. Please try again shortly.' : '문의를 받지 못했습니다. 잠시 뒤 다시 시도해 주세요.' }
  }

  // 편집장에게 알림 메일: 답장하면 문의한 사람에게 간다. 메일이 안 가도 접수는 된 것이다
  if (mailReady()) {
    try {
      const to = ((data ?? []) as { to_email: string }[]).map((r) => r.to_email).filter(Boolean)
      const url = `${await cmsOrigin()}/admin/inquiries`
      // 알림만: 문의 내용은 메일에 넣지 않고 편집국 '광고문의'에서 보고 답하게 한다
      const { html, text } = noticeMail({
        title: `${site.name}에 새 광고문의가 왔습니다`,
        lines: ['IM 뉴스룸 편집국의 “광고문의” 메뉴에서 내용을 확인하고 바로 답할 수 있습니다.'],
        button: { label: '편집국에서 확인하기', url },
        footer: `${site.name} 홈페이지 광고문의 양식으로 접수된 문의의 알림입니다.`,
      })
      await sendMails(to.map((e) => ({ to: e, subject: `[광고문의] 새 문의가 왔습니다 — ${site.name}`, html, text, fromName: 'IM 뉴스룸', tag: 'inquiry-ad' })))
    } catch {
      // 알림 실패는 조용히 넘긴다 (편집국 '광고문의'에는 남아 있다)
    }
  }
  return { ok: true }
}
