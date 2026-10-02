import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { mailReady } from '@/lib/mail'
import { newsletterLimit } from '@/lib/pricing'
import NewsletterComposer from '@/components/cms/NewsletterComposer'

// 발송에 시간이 걸릴 수 있다 (구독자가 많으면 500명씩 나눠 보낸다)
export const maxDuration = 60

export default async function NewsletterPage() {
  const { supabase, outletId, isEditorPlus, isStaff } = await getCmsContext()
  if (!isEditorPlus && !isStaff) redirect('/newsroom')
  if (!outletId) {
    return <div className="mx-auto max-w-[960px] px-4 py-10 md:px-8"><p className="rounded-lg border border-line bg-white px-5 py-4 text-sm">위쪽에서 뉴스레터를 보낼 매체를 먼저 골라 주세요.</p></div>
  }
  const count = (status: string) => supabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true }).eq('outlet_id', outletId).eq('status', status)
  const [{ data: outlet }, { data: arts }, sub, pend, uns, { data: subs, error }, { data: camps }] = await Promise.all([
    supabase.from('outlets').select('name, plan').eq('id', outletId).single(),
    supabase.from('articles').select('id, title, published_at, category:categories(name)').eq('outlet_id', outletId).eq('status', 'published').lte('published_at', new Date().toISOString()).order('published_at', { ascending: false }).limit(40),
    count('subscribed'), count('pending'), count('unsubscribed'),
    supabase.from('newsletter_subscribers').select('id, email, status, source, created_at').eq('outlet_id', outletId).order('created_at', { ascending: false }).limit(100),
    supabase.from('newsletter_campaigns').select('id, subject, recipient_count, failed_count, sent_at').eq('outlet_id', outletId).order('sent_at', { ascending: false }).limit(20),
  ])

  return (
    <div className="mx-auto max-w-[960px] px-4 py-5 md:px-8 md:py-8">
      <header className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight">뉴스레터</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          독자는 홈페이지 맨 아래 구독 칸에서 신청하고, 확인 메일의 버튼을 눌러야 구독이 시작됩니다. 모든 뉴스레터에는 수신거부 링크가 붙고, 수신거부한 독자에게는 다시 가지 않습니다.
        </p>
      </header>
      {error ? (
        <p className="rounded-lg border border-draft/40 bg-draft/10 px-5 py-4 text-sm">뉴스레터를 쓰려면 Supabase에서 <code>supabase/mail.sql</code>을 실행해 주세요.</p>
      ) : (
        <NewsletterComposer
          outletName={outlet?.name ?? ''}
          articles={((arts ?? []) as any[]).map((a) => ({ id: a.id, title: a.title, published_at: a.published_at, category: a.category?.name ?? null }))}
          counts={{ subscribed: sub.count ?? 0, pending: pend.count ?? 0, unsubscribed: uns.count ?? 0 }}
          subscribers={(subs ?? []) as any}
          campaigns={(camps ?? []) as any}
          limit={newsletterLimit((outlet as { plan?: string | null } | null)?.plan)}
          mailOn={mailReady()}
        />
      )}
    </div>
  )
}
