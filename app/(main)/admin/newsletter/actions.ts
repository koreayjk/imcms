'use server'

import { revalidatePath } from 'next/cache'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import { buildSite } from '@/lib/sites'
import { mailReady, sendMails, type Mail } from '@/lib/mail'
import { newsletterMailFor, type NewsletterArticle } from '@/lib/newsletter'
import { newsletterQuota } from '@/lib/pricing'
import { siteOrigin } from '@/lib/origin'
import { formatKst, nextRun, perMonthOf, quotaLabel, type NewsletterSchedule, type ScheduleKind } from '@/lib/newsletter-schedule'

export type NlState = { error?: string; ok?: string }
export type Draft = { subject: string; intro: string; articleIds: string[] }

// 작업 중인 매체의 홈페이지 설정·주소 (메일 속 링크는 매체 주소로)
async function outletContext() {
  const ctx = await getCmsContext()
  const { t, lang } = await getT()
  if (!ctx.isEditorPlus && !ctx.isStaff) throw new Error(t('뉴스레터는 편집장·발행인만 보낼 수 있습니다.', 'Only the Editor-in-Chief or Publisher can send newsletters.'))
  if (!ctx.outletId) throw new Error(t('위쪽에서 작업할 매체를 먼저 골라 주세요.', 'Choose an outlet to work on at the top first.'))
  const [{ data: outlet }, { data: cats }] = await Promise.all([
    ctx.supabase.from('outlets').select('*').eq('id', ctx.outletId).single(),
    ctx.supabase.from('categories').select('*').eq('outlet_id', ctx.outletId),
  ])
  if (!outlet) throw new Error(t('매체를 찾지 못했습니다.', 'Outlet not found.'))
  const site = buildSite(outlet as never, (cats ?? []) as never)
  const baseUrl = outlet.domain ? `https://${String(outlet.domain).replace(/^https?:\/\//, '')}` : (await siteOrigin())
  return { ...ctx, outlet, site, baseUrl, t, lang }
}

async function render(c: Awaited<ReturnType<typeof outletContext>>, d: Draft) {
  const subject = d.subject.trim().slice(0, 150)
  const ids = d.articleIds.slice(0, 15)
  if (!subject) throw new Error(c.t('제목을 적어 주세요.', 'Enter a subject.'))
  if (!ids.length) throw new Error(c.t('보낼 기사를 하나 이상 골라 주세요.', 'Choose at least one story to send.'))
  const { data } = await c.supabase
    .from('articles')
    .select('id, title, excerpt, thumbnail_url, published_at, category:categories(name)')
    .in('id', ids).eq('outlet_id', c.outletId!).eq('status', 'published')
  const byId = new Map((data ?? []).map((a: any) => [a.id as string, a]))
  const articles: NewsletterArticle[] = ids.map((id) => byId.get(id)).filter(Boolean).map((a: any) => ({ ...a, category: a.category?.name ?? null }))
  if (!articles.length) throw new Error(c.t('발행된 기사만 보낼 수 있습니다.', 'Only published stories can be sent.'))
  return { subject, intro: d.intro.trim().slice(0, 3000), articles }
}

function mailFor(c: Awaited<ReturnType<typeof outletContext>>, r: Awaited<ReturnType<typeof render>>, to: string, token: string | null): Mail {
  return newsletterMailFor(c.site, c.baseUrl, r, to, token)
}

// 미리보기 HTML (화면에서 보여주기용)
export async function previewNewsletter(d: Draft): Promise<{ html?: string; error?: string }> {
  const { t } = await getT()
  try {
    const c = await outletContext()
    const r = await render(c, d)
    return { html: mailFor(c, r, 'preview@example.com', null).html }
  } catch (e) {
    return { error: e instanceof Error ? e.message : t('미리보기를 만들지 못했습니다.', 'Could not create the preview.') }
  }
}

// 나에게 시험 발송
export async function sendTestNewsletter(d: Draft): Promise<NlState> {
  const { t } = await getT()
  try {
    const c = await outletContext()
    if (!mailReady()) return { error: t('메일 발송이 아직 설정되지 않았습니다. 운영팀에 문의해 주세요.', 'Email sending is not set up yet. Please contact the IM Newsroom team.') }
    const r = await render(c, d)
    const res = await sendMails([{ ...mailFor(c, r, c.user.email!, null), subject: `${t('[시험]', '[Test]')} ${r.subject}` }], 'broadcast')
    return res.sent ? { ok: t(`${c.user.email}(으)로 시험 메일을 보냈습니다.`, `Test email sent to ${c.user.email}.`) } : { error: `${t('보내지 못했습니다', 'Could not send')}: ${res.error ?? ''}` }
  } catch (e) {
    return { error: e instanceof Error ? e.message : t('보내지 못했습니다.', 'Could not send.') }
  }
}

// 구독자 전체에게 발송 (요금제별 한 번에 보낼 수 있는 인원까지)
export async function sendNewsletter(d: Draft): Promise<NlState> {
  const { t, lang } = await getT()
  try {
    if ((await getCmsContext()).trial) return { error: t('체험 중에는 구독자에게 보낼 수 없습니다. “나에게 시험 발송”으로 받아 보세요.', 'You cannot send to subscribers during the trial. Try “Send a test to me” instead.') }
    const c = await outletContext()
    if (!mailReady()) return { error: t('메일 발송이 아직 설정되지 않았습니다. 운영팀에 문의해 주세요.', 'Email sending is not set up yet. Please contact the IM Newsroom team.') }
    const r = await render(c, d)
    const quota = newsletterQuota((c.outlet as { plan?: string | null }).plan)
    if (!quota) return { error: t('뉴스레터는 스탠다드 요금제부터 쓸 수 있습니다. 요금제 변경은 고객센터 업무요청으로 문의해 주세요.', 'Newsletters are available from the Standard plan. To change plans, send a work request through Support.') }
    const limit = quota.perSend
    // 이번 달(한국 시각) 보낸 횟수
    const monthStart = `${new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 7)}-01T00:00:00+09:00`
    const { count: used } = await c.supabase.from('newsletter_campaigns').select('id', { count: 'exact', head: true }).eq('outlet_id', c.outletId!).eq('status', 'sent').gte('sent_at', monthStart)
    if ((used ?? 0) >= quota.perMonth) return { error: t(`이번 달 발송 횟수(월 ${quota.perMonth}회, ${quotaLabel(quota)})를 다 썼습니다. 다음 달 1일부터 다시 보낼 수 있습니다.`, `You have used up this month’s sends (${quota.perMonth} per month, ${quotaLabel(quota, lang)}). You can send again from the 1st of next month.`) }
    const { data: subs, error } = await c.supabase.from('newsletter_subscribers').select('email, token').eq('outlet_id', c.outletId!).eq('status', 'subscribed').limit(limit + 1)
    if (error) return { error: t('구독자 목록을 읽지 못했습니다. 운영팀에 mail.sql 실행을 요청해 주세요.', 'Could not read the subscriber list. Ask the IM Newsroom team to run mail.sql.') }
    if (!subs?.length) return { error: t('구독 중인 독자가 없습니다.', 'There are no active subscribers.') }
    if (subs.length > limit) return { error: t(`한 번에 ${limit.toLocaleString()}명까지 보낼 수 있습니다(지금 구독자 ${subs.length.toLocaleString()}명 이상). 요금제 변경은 고객센터에 문의해 주세요.`, `You can send to up to ${limit.toLocaleString('en-US')} people at a time (you currently have ${subs.length.toLocaleString('en-US')} or more subscribers). Contact Support to change plans.`) }
    const res = await sendMails(subs.map((s) => mailFor(c, r, s.email as string, s.token as string)), 'broadcast')
    await c.supabase.from('newsletter_campaigns').insert({
      outlet_id: c.outletId, subject: r.subject, intro: r.intro || null, article_ids: r.articles.map((a) => a.id),
      status: res.sent ? 'sent' : 'failed', recipient_count: res.sent, failed_count: res.failed,
    })
    revalidatePath('/admin/newsletter')
    if (!res.sent) return { error: `${t('보내지 못했습니다', 'Could not send')}: ${res.error ?? ''}` }
    return { ok: t(`${res.sent.toLocaleString()}명에게 보냈습니다.${res.failed ? ` (${res.failed}명 실패: ${res.error ?? ''})` : ''}`, `Sent to ${res.sent.toLocaleString('en-US')} ${res.sent === 1 ? 'person' : 'people'}.${res.failed ? ` (${res.failed} failed: ${res.error ?? ''})` : ''}`) }
  } catch (e) {
    return { error: e instanceof Error ? e.message : t('보내지 못했습니다.', 'Could not send.') }
  }
}

// 구독자 직접 추가 (이미 동의를 받은 주소만). 한 줄에 하나씩
export async function addSubscribers(raw: string, consented: boolean): Promise<NlState> {
  const { t } = await getT()
  try {
    const c = await outletContext()
    if (!consented) return { error: t('수신 동의를 받은 주소인지 확인해 주세요.', 'Confirm that these addresses have agreed to receive emails.') }
    const emails = Array.from(new Set(raw.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)))).slice(0, 2000)
    if (!emails.length) return { error: t('이메일 주소를 찾지 못했습니다.', 'No email addresses found.') }
    // 수신거부한 주소는 다시 넣지 않는다
    const { data: existing } = await c.supabase.from('newsletter_subscribers').select('email, status').eq('outlet_id', c.outletId!).in('email', emails)
    const known = new Map((existing ?? []).map((e) => [e.email as string, e.status as string]))
    const fresh = emails.filter((e) => !known.has(e))
    const now = new Date().toISOString()
    if (fresh.length) {
      const { error } = await c.supabase.from('newsletter_subscribers').insert(fresh.map((email) => ({ outlet_id: c.outletId, email, status: 'subscribed', source: 'import', consent_at: now, confirmed_at: now })))
      if (error) return { error: `${t('추가하지 못했습니다', 'Could not add')}: ${error.message}` }
    }
    revalidatePath('/admin/newsletter')
    const skipped = emails.length - fresh.length
    return { ok: t(`${fresh.length}명을 추가했습니다.${skipped ? ` (이미 있거나 수신거부한 ${skipped}명은 그대로 둠)` : ''}`, `Added ${fresh.length} ${fresh.length === 1 ? 'subscriber' : 'subscribers'}.${skipped ? ` (${skipped} already on the list or unsubscribed — left as is)` : ''}`) }
  } catch (e) {
    return { error: e instanceof Error ? e.message : t('추가하지 못했습니다.', 'Could not add.') }
  }
}

export async function removeSubscriber(id: string): Promise<NlState> {
  const { supabase } = await getCmsContext()
  const { t } = await getT()
  const { data, error } = await supabase.from('newsletter_subscribers').delete().eq('id', id).select('id')
  if (error || !data?.length) return { error: error?.message ?? t('지울 권한이 없습니다.', 'You do not have permission to delete this.') }
  revalidatePath('/admin/newsletter')
  return { ok: t('지웠습니다.', 'Deleted.') }
}

// ───────── 자동 발송 예약 (newsletter-schedule.sql) ─────────
export type ScheduleInput = {
  id?: string; kind: ScheduleKind; send_on?: string | null; weekday?: number | null; month_day?: number | null; hour: number
  article_count: number; section_slug?: string | null; subject_template: string; intro?: string | null
}

const scheduleSqlMissing = (m: string, t: (ko: string, en: string) => string) => /newsletter_schedules/.test(m) ? t('자동 발송을 쓰려면 운영팀이 Supabase에서 newsletter-schedule.sql을 먼저 실행해야 합니다.', 'To use scheduled sending, the IM Newsroom team must first run newsletter-schedule.sql in Supabase.') : m

export async function saveSchedule(input: ScheduleInput): Promise<NlState> {
  const { t, lang } = await getT()
  try {
    const c = await outletContext()
    const quota = newsletterQuota((c.outlet as { plan?: string | null }).plan)
    if (!quota) return { error: t('뉴스레터는 스탠다드 요금제부터 쓸 수 있습니다.', 'Newsletters are available from the Standard plan.') }
    const kind = (['once', 'weekly', 'biweekly', 'monthly'] as const).includes(input.kind) ? input.kind : 'weekly'
    const hour = Math.min(23, Math.max(0, Math.round(input.hour)))
    const row = {
      outlet_id: c.outletId!, kind, hour,
      send_on: kind === 'once' ? (input.send_on && /^\d{4}-\d{2}-\d{2}$/.test(input.send_on) ? input.send_on : null) : null,
      weekday: kind === 'weekly' || kind === 'biweekly' ? Math.min(6, Math.max(0, Math.round(input.weekday ?? 1))) : null,
      month_day: kind === 'monthly' ? Math.min(28, Math.max(1, Math.round(input.month_day ?? 1))) : null,
      article_count: Math.min(15, Math.max(1, Math.round(input.article_count || 5))),
      section_slug: input.section_slug || null,
      subject_template: input.subject_template.trim().slice(0, 150) || t('{매체} {날짜} 주요 뉴스', '{outlet} {date} Top Stories'),
      intro: input.intro?.trim().slice(0, 3000) || null,
    }
    if (kind === 'once' && !row.send_on) return { error: t('보낼 날짜를 골라 주세요.', 'Choose a date to send.') }
    const next = nextRun(row, new Date())
    if (!next) return { error: t('이미 지난 날짜·시각입니다. 앞으로의 날짜를 골라 주세요.', 'That date and time has already passed. Choose a future date.') }
    // 요금제 한 달 한도 안에 들어오는지 (켜 둔 다른 예약과 합쳐서)
    const { data: others, error: oErr } = await c.supabase.from('newsletter_schedules').select('id, kind').eq('outlet_id', c.outletId!).eq('enabled', true)
    if (oErr) return { error: scheduleSqlMissing(oErr.message, t) }
    const planned = ((others ?? []) as { id: string; kind: ScheduleKind }[]).filter((o) => o.id !== input.id && o.kind !== 'once').reduce((n, o) => n + perMonthOf(o.kind), 0) + (kind === 'once' ? 0 : perMonthOf(kind))
    if (planned > quota.perMonth) return { error: t(`켜 둔 자동 발송을 합치면 한 달 최대 ${planned}회로, 요금제 한도(${quotaLabel(quota)}, 월 ${quota.perMonth}회)를 넘습니다. 다른 예약을 끄거나 주기를 늘려 주세요.`, `All active scheduled sends together come to up to ${planned} per month, which exceeds your plan limit (${quotaLabel(quota, lang)}, ${quota.perMonth} per month). Turn off another schedule or lengthen the interval.`) }
    const payload = { ...row, enabled: true, next_run_at: next.toISOString(), updated_at: new Date().toISOString() }
    const { error } = input.id
      ? await c.supabase.from('newsletter_schedules').update(payload).eq('id', input.id).eq('outlet_id', c.outletId!)
      : await c.supabase.from('newsletter_schedules').insert(payload)
    if (error) return { error: scheduleSqlMissing(error.message, t) }
    revalidatePath('/admin/newsletter')
    return { ok: t(`저장했습니다. 첫 발송: ${formatKst(next.toISOString())}`, `Saved. First send: ${formatKst(next.toISOString(), 'en')} KST`) }
  } catch (e) {
    return { error: e instanceof Error ? e.message : t('저장하지 못했습니다.', 'Could not save.') }
  }
}

async function scheduleRow(id: string) {
  const c = await outletContext()
  const { data } = await c.supabase.from('newsletter_schedules').select('*').eq('id', id).eq('outlet_id', c.outletId!).maybeSingle()
  return { c, s: data as NewsletterSchedule | null }
}

// 이번 회차만 건너뛰기 (다음 회차로 넘긴다. 한 번만 보내기는 취소)
export async function skipNextSchedule(id: string): Promise<NlState> {
  const { c, s } = await scheduleRow(id)
  const { t } = await getT()
  if (!s?.next_run_at) return { error: t('예약을 찾지 못했습니다.', 'Schedule not found.') }
  const cur = new Date(s.next_run_at)
  const next = nextRun(s, cur, cur)
  const { error } = await c.supabase.from('newsletter_schedules').update({ next_run_at: next?.toISOString() ?? null, enabled: !!next, last_result: t(`${formatKst(s.next_run_at)} 회차를 건너뛰었습니다.`, `Skipped the ${formatKst(s.next_run_at, 'en')} KST send.`), updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/newsletter')
  return { ok: next ? t(`이번 회차를 건너뛰었습니다. 다음 발송: ${formatKst(next.toISOString())}`, `Skipped this send. Next send: ${formatKst(next.toISOString(), 'en')} KST`) : t('이 예약을 취소했습니다.', 'Schedule cancelled.') }
}

export async function toggleSchedule(id: string, on: boolean): Promise<NlState> {
  const { c, s } = await scheduleRow(id)
  const { t } = await getT()
  if (!s) return { error: t('예약을 찾지 못했습니다.', 'Schedule not found.') }
  if (on) return saveSchedule({ ...s, id })
  const { error } = await c.supabase.from('newsletter_schedules').update({ enabled: false, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/newsletter')
  return { ok: t('자동 발송을 멈췄습니다.', 'Scheduled sending paused.') }
}

export async function deleteSchedule(id: string): Promise<NlState> {
  const { c } = await scheduleRow(id)
  const { t } = await getT()
  const { error } = await c.supabase.from('newsletter_schedules').delete().eq('id', id).eq('outlet_id', c.outletId!)
  if (error) return { error: error.message }
  revalidatePath('/admin/newsletter')
  return { ok: t('예약을 지웠습니다.', 'Schedule deleted.') }
}
