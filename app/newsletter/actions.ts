'use server'

import { createClient } from '@supabase/supabase-js'
import { currentSite } from '@/lib/public-data'
import { mailReady, noticeMail, sendMails } from '@/lib/mail'
import { siteOrigin } from '@/lib/origin'
import { paymentDbSecret } from '@/lib/toss'

export type SubscribeState = { ok?: boolean; error?: string }

const anon = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })

// 홈페이지 뉴스레터 구독 신청 → 확인 메일 (링크를 눌러야 구독 시작)
export async function subscribeNewsletter(_prev: SubscribeState, form: FormData): Promise<SubscribeState> {
  if (String(form.get('website') ?? '')) return { ok: true } // 봇
  const email = String(form.get('email') ?? '').trim().toLowerCase().slice(0, 200)
  const name = String(form.get('name') ?? '').trim().slice(0, 60)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: '이메일 주소를 확인해 주세요.' }
  if (form.get('agree') !== 'on') return { error: '개인정보 수집·이용에 동의해야 구독할 수 있습니다.' }
  const site = await currentSite()
  if (!site.outletId || !mailReady() || !process.env.PAYMENT_DB_SECRET) return { error: '뉴스레터는 준비 중입니다.' }

  const { data: token, error } = await anon().rpc('newsletter_subscribe', { secret: paymentDbSecret(), o: site.outletId, p_email: email, p_name: name })
  if (error) return { error: '신청을 받지 못했습니다. 잠시 뒤 다시 시도해 주세요.' }
  if (!token) return { ok: true } // 이미 구독 중
  const url = `${(await siteOrigin())}/newsletter/confirm?t=${token}`
  const { html, text } = noticeMail({
    title: `${site.name} 뉴스레터 구독을 확인해 주세요`,
    lines: ['아래 버튼을 누르면 구독이 시작됩니다.', '직접 신청하지 않으셨다면 이 메일을 무시하세요. 구독되지 않습니다.'],
    button: { label: '구독 확인', url },
    footer: `${site.name} 뉴스레터 구독 확인 메일입니다.`,
  })
  const res = await sendMails([{ to: email, subject: `[${site.name}] 뉴스레터 구독 확인`, html, text, fromName: site.name, tag: 'newsletter-confirm' }])
  if (!res.sent) return { error: '확인 메일을 보내지 못했습니다. 주소를 확인해 주세요.' }
  return { ok: true }
}

export async function confirmNewsletter(token: string): Promise<{ outlet: string | null }> {
  if (!/^[0-9a-f]{20,64}$/.test(token)) return { outlet: null }
  const { data } = await anon().rpc('newsletter_confirm', { p_token: token })
  return { outlet: (data as string | null) ?? null }
}

export async function unsubscribeNewsletter(token: string): Promise<{ done: boolean }> {
  if (!/^[0-9a-f]{20,64}$/.test(token)) return { done: false }
  await anon().rpc('newsletter_unsubscribe', { p_token: token })
  return { done: true }
}
