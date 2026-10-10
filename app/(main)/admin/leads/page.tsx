import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { formatDateTime } from '@/lib/format'
import { PRODUCT } from '@/lib/product'
import LeadCard, { type Lead } from '@/components/cms/LeadCard'
import AutoMessageEditor from '@/components/cms/AutoMessageEditor'

type Props = { searchParams: Promise<{ tab?: string }> }

export default async function LeadsPage(props: Props) {
  const searchParams = await props.searchParams
  const { supabase, user, isStaff } = await getCmsContext()
  if (!isStaff) redirect('/newsroom')
  const tab = ['mine', 'open', 'done', 'trial'].includes(searchParams.tab ?? '') ? searchParams.tab : 'open'

  const [{ data, error }, { data: staffRows }, { data: groups }, trialRes] = await Promise.all([
    supabase.from('beta_requests').select('*').order('created_at', { ascending: false }).limit(300),
    supabase.from('profiles').select('id, full_name, is_super, is_staff'),
    supabase.from('publishers').select('id, name'),
    // 1주일 무료 체험 신청자 (trial.sql 전이면 표가 없어 탭을 숨긴다)
    supabase.from('trial_signups').select('*').order('created_at', { ascending: false }).limit(300),
  ])
  type TrialRow = { user_id: string; email: string | null; name: string | null; company: string | null; position: string | null; phone: string | null; created_at: string }
  const trials = (trialRes.data ?? []) as TrialRow[]
  const { data: trialProfiles } = trials.length
    ? await supabase.from('profiles').select('id, trial_until').in('id', trials.map((t) => t.user_id))
    : { data: [] }
  // 5일째 자동 안내 (trial-checkin.sql 전이면 표가 없어 숨긴다)
  const [{ data: autoMsg }, { data: checkins }] = tab === 'trial'
    ? await Promise.all([
        supabase.from('auto_messages').select('title, body, enabled').eq('key', 'trial_day5').maybeSingle(),
        supabase.from('trial_checkins').select('user_id, sent_at'),
      ])
    : [{ data: null }, { data: null }]
  const checkedAt = new Map(((checkins ?? []) as { user_id: string; sent_at: string }[]).map((c) => [c.user_id, c.sent_at]))
  const trialUntil = new Map(((trialProfiles ?? []) as { id: string; trial_until: string | null }[]).map((p) => [p.id, p.trial_until]))
  // 체험신문 발행 전 검사에 걸려 총관리자 확인을 기다리는 기사 (trial-moderation.sql 전이면 칸이 없어 빈 목록)
  type HeldRow = { id: string; title: string; moderation_note: string | null; updated_at: string; author: { full_name: string | null } | null }
  const { data: heldData } = await supabase.from('articles')
    .select('id, title, moderation_note, updated_at, author:profiles!articles_author_id_fkey(full_name)')
    .eq('moderation_hold', true).eq('status', 'in_review').order('updated_at', { ascending: false }).limit(50)
  const held = (heldData ?? []) as unknown as HeldRow[]
  const trialState = (id: string) => {
    const u = trialUntil.get(id)
    if (!u) return '계정 삭제됨'
    const days = Math.ceil((Date.parse(u) - Date.now()) / 86_400_000)
    return days > 0 ? `체험 중 · ${days}일 남음` : '체험 끝남'
  }
  const staff = ((staffRows ?? []) as any[]).filter((p) => p.is_super || p.is_staff).map((p) => ({ id: p.id as string, name: p.full_name as string }))
  const groupName = new Map((groups ?? []).map((g) => [g.id as string, g.name as string]))
  const all = (data ?? []) as Lead[]
  const rows = tab === 'mine' ? all.filter((l) => l.assigned_to === user.id && l.status !== 'done')
    : tab === 'done' ? all.filter((l) => l.status === 'done')
    : all.filter((l) => l.status !== 'done')

  const tabs = [
    { key: 'open', label: '처리할 상담', n: all.filter((l) => l.status !== 'done').length },
    { key: 'mine', label: '내 담당', n: all.filter((l) => l.assigned_to === user.id && l.status !== 'done').length },
    { key: 'done', label: '완료', n: all.filter((l) => l.status === 'done').length },
    ...(trialRes.error ? [] : [{ key: 'trial', label: held.length ? `무료 체험 · 확인 ${held.length}` : '무료 체험', n: trials.length }]),
  ]

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-5 md:px-8 md:py-8">
      <header className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight">고객 상담</h1>
        <p className="mt-1 text-[13px] text-muted">
          {PRODUCT.name} 소개 페이지에서 들어온 신청입니다. 담당 매니저를 정하고 상담 기록을 남긴 뒤, 계약되면 “고객사 개설”로 그룹·매체·발행인을 한 번에 만듭니다. 신청일로부터 1년이 지나면 자동으로 지워집니다.
        </p>
      </header>
      <nav className="mb-4 flex gap-1 text-[14px]">
        {tabs.map((t) => (
          <a key={t.key} href={`/admin/leads?tab=${t.key}`} className={`rounded-full px-3.5 py-1.5 ${tab === t.key ? 'bg-ink font-bold text-white' : 'text-muted hover:text-ink'}`}>
            {t.label} <span className="tabular-nums opacity-70">{t.n}</span>
          </a>
        ))}
      </nav>
      {tab === 'trial' && held.length > 0 && (
        <section aria-labelledby="held-title" className="mb-4 rounded-lg border border-danger/30 bg-danger/5 px-5 py-4">
          <h2 id="held-title" className="text-[14.5px] font-bold text-danger">총관리자 확인을 기다리는 체험 기사 {held.length}건</h2>
          <p className="mt-1 text-[12.5px] text-muted">발행 전 검사에서 욕설·혐오·선정적 표현이 있을 수 있다고 나온 기사입니다. 열어서 승인하면 발행되고, 반려하거나 지울 수 있습니다.</p>
          <ul className="mt-3 divide-y divide-danger/15 text-[13.5px]">
            {held.map((h) => (
              <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
                <a href={`/articles/${h.id}`} className="font-semibold hover:underline">{h.title}</a>
                <span className="text-[12.5px] text-muted">{h.author?.full_name ?? ''} · {formatDateTime(h.updated_at)}</span>
                {h.moderation_note && <span className="w-full text-[12.5px] text-danger">{h.moderation_note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
      {tab === 'trial' && autoMsg && <AutoMessageEditor initial={autoMsg as { title: string; body: string; enabled: boolean }} />}
      {tab === 'trial' ? (
        trials.length ? (
          <div className="overflow-x-auto rounded-lg border border-line bg-white">
            <table className="w-full min-w-[760px] text-[13.5px]">
              <thead className="bg-paper text-left text-[12.5px] text-muted">
                <tr><th className="px-4 py-2.5">신청일</th><th className="px-4 py-2.5">이름</th><th className="px-4 py-2.5">언론사 · 직함</th><th className="px-4 py-2.5">연락처</th><th className="px-4 py-2.5">상태</th><th className="px-4 py-2.5"></th></tr>
              </thead>
              <tbody>
                {trials.map((t) => (
                  <tr key={t.user_id} className="border-t border-line">
                    <td className="px-4 py-3 tabular-nums text-muted">{formatDateTime(t.created_at)}</td>
                    <td className="px-4 py-3 font-semibold">{t.name}</td>
                    <td className="px-4 py-3">{t.company}{t.position ? ` · ${t.position}` : ''}</td>
                    <td className="px-4 py-3"><a href={`tel:${t.phone ?? ''}`} className="hover:underline">{t.phone}</a><br /><a href={`mailto:${t.email ?? ''}`} className="text-muted hover:underline">{t.email}</a></td>
                    <td className="px-4 py-3">{trialState(t.user_id)}{checkedAt.get(t.user_id) && <><br /><span className="text-[12px] text-[#2F6BF0]">5일째 안내 보냄 · {formatDateTime(checkedAt.get(t.user_id)!)}</span></>}</td>
                    <td className="px-4 py-3 text-right"><a href={`/support/tickets/new?to=${t.user_id}`} className="whitespace-nowrap rounded-full border border-line px-3 py-1.5 text-[12.5px] font-semibold hover:border-ink">고객센터로 안내 보내기</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-lg border border-line bg-white px-5 py-16 text-center text-sm text-muted">아직 체험 신청이 없습니다.</p>
        )
      ) : error ? (
        <p className="rounded-lg border border-draft/40 bg-draft/10 px-5 py-4 text-sm">신청서를 받으려면 Supabase에서 <code>supabase/beta-requests.sql</code>을 실행해 주세요.</p>
      ) : rows.length ? (
        <ul className="space-y-3">
          {rows.map((l) => (
            <LeadCard key={l.id} lead={l} staff={staff} createdLabel={formatDateTime(l.created_at)} groupName={l.publisher_id ? groupName.get(l.publisher_id) ?? null : null} />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-line bg-white px-5 py-16 text-center text-sm text-muted">해당하는 상담이 없습니다.</p>
      )}
    </div>
  )
}
