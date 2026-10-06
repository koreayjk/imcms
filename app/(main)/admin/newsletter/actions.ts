'use server'

import { revalidatePath } from 'next/cache'
import { getCmsContext } from '@/lib/cms'
import { buildSite } from '@/lib/sites'
import { mailReady, sendMails, type Mail } from '@/lib/mail'
import { legalLine, newsletterMail, type NewsletterArticle } from '@/lib/newsletter'
import { newsletterLimit } from '@/lib/pricing'
import { siteOrigin } from '@/lib/origin'

export type NlState = { error?: string; ok?: string }
export type Draft = { subject: string; intro: string; articleIds: string[] }

// 작업 중인 매체의 홈페이지 설정·주소 (메일 속 링크는 매체 주소로)
async function outletContext() {
  const ctx = await getCmsContext()
  if (!ctx.isEditorPlus && !ctx.isStaff) throw new Error('뉴스레터는 편집장·발행인만 보낼 수 있습니다.')
  if (!ctx.outletId) throw new Error('위쪽에서 작업할 매체를 먼저 골라 주세요.')
  const [{ data: outlet }, { data: cats }] = await Promise.all([
    ctx.supabase.from('outlets').select('*').eq('id', ctx.outletId).single(),
    ctx.supabase.from('categories').select('*').eq('outlet_id', ctx.outletId),
  ])
  if (!outlet) throw new Error('매체를 찾지 못했습니다.')
  const site = buildSite(outlet as never, (cats ?? []) as never)
  const baseUrl = outlet.domain ? `https://${String(outlet.domain).replace(/^https?:\/\//, '')}` : (await siteOrigin())
  return { ...ctx, outlet, site, baseUrl }
}

async function render(c: Awaited<ReturnType<typeof outletContext>>, d: Draft) {
  const subject = d.subject.trim().slice(0, 150)
  const ids = d.articleIds.slice(0, 15)
  if (!subject) throw new Error('제목을 적어 주세요.')
  if (!ids.length) throw new Error('보낼 기사를 하나 이상 골라 주세요.')
  const { data } = await c.supabase
    .from('articles')
    .select('id, title, excerpt, thumbnail_url, published_at, category:categories(name)')
    .in('id', ids).eq('outlet_id', c.outletId!).eq('status', 'published')
  const byId = new Map((data ?? []).map((a: any) => [a.id as string, a]))
  const articles: NewsletterArticle[] = ids.map((id) => byId.get(id)).filter(Boolean).map((a: any) => ({ ...a, category: a.category?.name ?? null }))
  if (!articles.length) throw new Error('발행된 기사만 보낼 수 있습니다.')
  return { subject, intro: d.intro.trim().slice(0, 3000), articles }
}

function mailFor(c: Awaited<ReturnType<typeof outletContext>>, r: Awaited<ReturnType<typeof render>>, to: string, token: string | null): Mail {
  const unsubscribeUrl = token ? `${c.baseUrl}/newsletter/unsubscribe?t=${token}` : `${c.baseUrl}/newsletter/unsubscribe`
  const { html, text } = newsletterMail({ site: c.site, baseUrl: c.baseUrl, subject: r.subject, intro: r.intro, articles: r.articles, unsubscribeUrl, legalLine: legalLine(c.site) })
  return {
    to, subject: r.subject, html, text, fromName: c.site.name, tag: 'newsletter',
    replyTo: c.site.legal.email || null,
    headers: token ? { 'List-Unsubscribe': `<${c.baseUrl}/api/newsletter/unsubscribe?t=${token}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : undefined,
  }
}

// 미리보기 HTML (화면에서 보여주기용)
export async function previewNewsletter(d: Draft): Promise<{ html?: string; error?: string }> {
  try {
    const c = await outletContext()
    const r = await render(c, d)
    return { html: mailFor(c, r, 'preview@example.com', null).html }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '미리보기를 만들지 못했습니다.' }
  }
}

// 나에게 시험 발송
export async function sendTestNewsletter(d: Draft): Promise<NlState> {
  try {
    const c = await outletContext()
    if (!mailReady()) return { error: '메일 발송이 아직 설정되지 않았습니다. 운영팀에 문의해 주세요.' }
    const r = await render(c, d)
    const res = await sendMails([{ ...mailFor(c, r, c.user.email!, null), subject: `[시험] ${r.subject}` }], 'broadcast')
    return res.sent ? { ok: `${c.user.email}(으)로 시험 메일을 보냈습니다.` } : { error: `보내지 못했습니다: ${res.error ?? ''}` }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '보내지 못했습니다.' }
  }
}

// 구독자 전체에게 발송 (요금제별 한 번에 보낼 수 있는 인원까지)
export async function sendNewsletter(d: Draft): Promise<NlState> {
  try {
    if ((await getCmsContext()).trial) return { error: '체험 중에는 구독자에게 보낼 수 없습니다. “나에게 시험 발송”으로 받아 보세요.' }
    const c = await outletContext()
    if (!mailReady()) return { error: '메일 발송이 아직 설정되지 않았습니다. 운영팀에 문의해 주세요.' }
    const r = await render(c, d)
    const limit = newsletterLimit((c.outlet as { plan?: string | null }).plan)
    const { data: subs, error } = await c.supabase.from('newsletter_subscribers').select('email, token').eq('outlet_id', c.outletId!).eq('status', 'subscribed').limit(limit + 1)
    if (error) return { error: '구독자 목록을 읽지 못했습니다. 운영팀에 mail.sql 실행을 요청해 주세요.' }
    if (!subs?.length) return { error: '구독 중인 독자가 없습니다.' }
    if (subs.length > limit) return { error: `한 번에 ${limit.toLocaleString()}명까지 보낼 수 있습니다(지금 구독자 ${subs.length.toLocaleString()}명 이상). 요금제 변경은 고객센터에 문의해 주세요.` }
    const res = await sendMails(subs.map((s) => mailFor(c, r, s.email as string, s.token as string)), 'broadcast')
    await c.supabase.from('newsletter_campaigns').insert({
      outlet_id: c.outletId, subject: r.subject, intro: r.intro || null, article_ids: r.articles.map((a) => a.id),
      status: res.sent ? 'sent' : 'failed', recipient_count: res.sent, failed_count: res.failed,
    })
    revalidatePath('/admin/newsletter')
    if (!res.sent) return { error: `보내지 못했습니다: ${res.error ?? ''}` }
    return { ok: `${res.sent.toLocaleString()}명에게 보냈습니다.${res.failed ? ` (${res.failed}명 실패: ${res.error ?? ''})` : ''}` }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '보내지 못했습니다.' }
  }
}

// 구독자 직접 추가 (이미 동의를 받은 주소만). 한 줄에 하나씩
export async function addSubscribers(raw: string, consented: boolean): Promise<NlState> {
  try {
    const c = await outletContext()
    if (!consented) return { error: '수신 동의를 받은 주소인지 확인해 주세요.' }
    const emails = Array.from(new Set(raw.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))).slice(0, 2000)
    if (!emails.length) return { error: '이메일 주소를 찾지 못했습니다.' }
    // 수신거부한 주소는 다시 넣지 않는다
    const { data: existing } = await c.supabase.from('newsletter_subscribers').select('email, status').eq('outlet_id', c.outletId!).in('email', emails)
    const known = new Map((existing ?? []).map((e) => [e.email as string, e.status as string]))
    const fresh = emails.filter((e) => !known.has(e))
    const now = new Date().toISOString()
    if (fresh.length) {
      const { error } = await c.supabase.from('newsletter_subscribers').insert(fresh.map((email) => ({ outlet_id: c.outletId, email, status: 'subscribed', source: 'import', consent_at: now, confirmed_at: now })))
      if (error) return { error: `추가하지 못했습니다: ${error.message}` }
    }
    revalidatePath('/admin/newsletter')
    const skipped = emails.length - fresh.length
    return { ok: `${fresh.length}명을 추가했습니다.${skipped ? ` (이미 있거나 수신거부한 ${skipped}명은 그대로 둠)` : ''}` }
  } catch (e) {
    return { error: e instanceof Error ? e.message : '추가하지 못했습니다.' }
  }
}

export async function removeSubscriber(id: string): Promise<NlState> {
  const { supabase } = await getCmsContext()
  const { data, error } = await supabase.from('newsletter_subscribers').delete().eq('id', id).select('id')
  if (error || !data?.length) return { error: error?.message ?? '지울 권한이 없습니다.' }
  revalidatePath('/admin/newsletter')
  return { ok: '지웠습니다.' }
}
