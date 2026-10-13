import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { buildSite } from '@/lib/sites'
import { mailReady, noticeMail, sendMails } from '@/lib/mail'
import { newsletterMailFor, type NewsletterArticle } from '@/lib/newsletter'
import { newsletterQuota } from '@/lib/pricing'
import { formatKst, nextRun, renderSubject, type NewsletterSchedule } from '@/lib/newsletter-schedule'
import { cmsOrigin } from '@/lib/origin'
import { paymentDbSecret } from '@/lib/toss'

// 뉴스레터 자동 발송 (newsletter-schedule.sql): Supabase 예약 작업이 10분마다 부른다
//   ① 하루 전 미리보기 안내 ② 때가 된 예약 보내기 (한 번에 2건씩 → 같은 시각 예약이 많아도 몇 분씩 나눠 나간다)
export const maxDuration = 60
export const dynamic = 'force-dynamic'

type Taken = { schedule: NewsletterSchedule; outlet: Record<string, unknown> & { id: string; name: string; domain: string | null; plan?: string | null }; categories: unknown[]; usedThisMonth: number; subscribers: number }

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (!secret || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.PAYMENT_DB_SECRET) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: allowed } = await supabase.rpc('press_cron_check', { secret })
  if (allowed !== true) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!mailReady()) return NextResponse.json({ skipped: 'mail not configured' })
  const db = paymentDbSecret()
  const origin = await cmsOrigin()
  const report: string[] = []

  // ① 하루 전 미리보기 안내
  const { data: previews } = await supabase.rpc('nl_preview_take', { secret: db })
  for (const p of (previews ?? []) as { schedule: NewsletterSchedule; outletName: string; to: string[] }[]) {
    if (!p.to?.length || !p.schedule.next_run_at) continue
    const when = formatKst(p.schedule.next_run_at)
    const { data: arts } = await supabase.rpc('nl_auto_articles', { secret: db, o: p.schedule.outlet_id, n: p.schedule.article_count, p_section: p.schedule.section_slug })
    const list = ((arts ?? []) as { title: string }[]).map((a) => `· ${a.title}`)
    const m = noticeMail({
      title: `내일 뉴스레터가 자동으로 나갑니다`,
      lines: [
        `${p.outletName} · ${when} · “${renderSubject(p.schedule.subject_template, p.outletName, new Date(p.schedule.next_run_at))}”`,
        list.length ? `지금 기준으로 들어갈 기사 ${list.length}건 (보내는 순간 최신 기사로 다시 고릅니다)` : '지금은 지난 뉴스레터 뒤에 새로 발행한 기사가 없습니다. 내일까지도 없으면 이번 회차는 건너뜁니다.',
        ...list.slice(0, 10),
        '이번 회차를 보내지 않으려면 편집국 → 뉴스레터 → 자동 발송에서 “이번 회차 건너뛰기”를 누르세요.',
      ],
      button: { label: '자동 발송 확인하기', url: `${origin}/admin/newsletter` },
      footer: 'IM 뉴스룸 뉴스레터 자동 발송 안내입니다.',
    })
    await sendMails(p.to.map((to) => ({ to, subject: `[IM 뉴스룸] 내일 ${when} 뉴스레터 자동 발송 예정`, ...m, tag: 'newsletter-preview' }))).catch(() => null)
    report.push(`preview:${p.schedule.id}`)
  }

  // ② 때가 된 예약 보내기
  const { data: taken, error } = await supabase.rpc('nl_schedule_take', { secret: db, p_limit: 2 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  for (const t of (taken ?? []) as Taken[]) {
    const s = t.schedule
    const due = s.next_run_at ? new Date(s.next_run_at) : new Date()
    const next = nextRun(s, new Date(Math.max(Date.now(), due.getTime())), due)
    const done = (result: string, sent?: { subject: string; intro: string; ids: string[]; sent: number; failed: number }) =>
      supabase.rpc('nl_schedule_done', {
        secret: db, p_id: s.id, p_result: result, p_next: next?.toISOString() ?? null,
        p_subject: sent?.subject ?? null, p_intro: sent?.intro ?? null, p_article_ids: sent?.ids ?? null, p_sent: sent?.sent ?? 0, p_failed: sent?.failed ?? 0,
      })
    try {
      const quota = newsletterQuota(t.outlet.plan)
      if (!quota) { await done('뉴스레터를 쓸 수 없는 요금제라 건너뛰었습니다.'); continue }
      if (t.usedThisMonth >= quota.perMonth) { await done(`이번 달 발송 횟수(월 ${quota.perMonth}회)를 다 써서 건너뛰었습니다.`); continue }
      if (t.subscribers > quota.perSend) { await done(`구독자(${t.subscribers}명)가 회당 한도(${quota.perSend}명)보다 많아 건너뛰었습니다. 요금제 변경을 문의해 주세요.`); continue }
      if (!t.subscribers) { await done('구독 중인 독자가 없어 건너뛰었습니다.'); continue }
      const { data: arts } = await supabase.rpc('nl_auto_articles', { secret: db, o: s.outlet_id, n: s.article_count, p_section: s.section_slug })
      const articles = (arts ?? []) as NewsletterArticle[]
      if (!articles.length) { await done('지난 뉴스레터 뒤에 새로 발행한 기사가 없어 건너뛰었습니다.'); continue }
      const site = buildSite(t.outlet as never, t.categories as never)
      const baseUrl = t.outlet.domain ? `https://${String(t.outlet.domain).replace(/^https?:\/\//, '')}` : origin
      const content = { subject: renderSubject(s.subject_template, site.name, due), intro: (s.intro ?? '').trim(), articles }
      const { data: subs } = await supabase.rpc('nl_auto_subscribers', { secret: db, o: s.outlet_id, lim: quota.perSend })
      const mails = ((subs ?? []) as { email: string; token: string }[]).map((r) => newsletterMailFor(site, baseUrl, content, r.email, r.token))
      const res = await sendMails(mails, 'broadcast')
      await done(res.sent ? `${res.sent}명에게 보냈습니다${res.failed ? ` (실패 ${res.failed}명: ${res.error ?? ''})` : ''}.` : `보내지 못했습니다: ${res.error ?? ''}`,
        { subject: content.subject, intro: content.intro, ids: articles.map((a) => a.id), sent: res.sent, failed: res.failed })
      report.push(`sent:${s.id}:${res.sent}`)
    } catch (e) {
      await done(`보내지 못했습니다: ${e instanceof Error ? e.message : '알 수 없는 오류'}`)
    }
  }
  return NextResponse.json({ at: new Date().toISOString(), report })
}
