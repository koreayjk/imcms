import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import { formatDateTime } from '@/lib/format'
import { PRODUCT } from '@/lib/product'
import LeadCard, { type Lead, type LaunchLink } from '@/components/cms/LeadCard'
import AutoMessageEditor from '@/components/cms/AutoMessageEditor'
import type { LaunchDone } from '@/lib/launch-checklist'
import { ONBOARDING_STEPS, stepStates } from '@/lib/onboarding-guide'

type Props = { searchParams: Promise<{ tab?: string }> }

export default async function LeadsPage(props: Props) {
  const searchParams = await props.searchParams
  const { supabase, user, isStaff, isSuper } = await getCmsContext()
  const { t, lang } = await getT()
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
    ? await supabase.from('profiles').select('id, trial_until').in('id', trials.map((x) => x.user_id))
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
    if (!u) return t('계정 삭제됨', 'Account deleted')
    const days = Math.ceil((Date.parse(u) - Date.now()) / 86_400_000)
    return days > 0 ? t(`체험 중 · ${days}일 남음`, `On trial · ${days} ${days === 1 ? 'day' : 'days'} left`) : t('체험 끝남', 'Trial ended')
  }
  const staff = ((staffRows ?? []) as any[]).filter((p) => p.is_super || p.is_staff).map((p) => ({ id: p.id as string, name: p.full_name as string }))
  const groupName = new Map((groups ?? []).map((g) => [g.id as string, g.name as string]))
  const all = (data ?? []) as Lead[]
  const rows = tab === 'mine' ? all.filter((l) => l.assigned_to === user.id && l.status !== 'done')
    : tab === 'done' ? all.filter((l) => l.status === 'done')
    : all.filter((l) => l.status !== 'done')

  // 개설된 고객사의 매체와 개통 체크리스트 (launch-checklist.sql 전이면 표가 없다고 알려 준다)
  const pubIds = [...new Set(rows.map((l) => l.publisher_id).filter(Boolean))] as string[]
  const [{ data: pubOutlets }, launchRes] = pubIds.length
    ? await Promise.all([
        supabase.from('outlets').select('id, name, domain, publisher_id').in('publisher_id', pubIds).order('created_at'),
        supabase.from('launch_checklists').select('outlet_id, done'),
      ])
    : [{ data: [] }, { data: [], error: null }]
  const launchDone = new Map(((launchRes.data ?? []) as { outlet_id: string; done: LaunchDone }[]).map((r) => [r.outlet_id, r.done]))
  const launchOf = (pid: string): LaunchLink[] =>
    ((pubOutlets ?? []) as { id: string; name: string; domain: string | null; publisher_id: string }[])
      .filter((o) => o.publisher_id === pid)
      .map((o) => ({ id: o.id, name: o.name, pct: Math.round((stepStates(launchDone.get(o.id) ?? {}, true).filter((s) => s === 'done').length / ONBOARDING_STEPS.length) * 100) }))

  const tabs = [
    { key: 'open', label: t('처리할 상담', 'To handle'), n: all.filter((l) => l.status !== 'done').length },
    { key: 'mine', label: t('내 담당', 'Assigned to me'), n: all.filter((l) => l.assigned_to === user.id && l.status !== 'done').length },
    { key: 'done', label: t('완료', 'Done'), n: all.filter((l) => l.status === 'done').length },
    ...(trialRes.error ? [] : [{ key: 'trial', label: held.length ? t(`무료 체험 · 확인 ${held.length}`, `Free trial · ${held.length} to review`) : t('무료 체험', 'Free trial'), n: trials.length }]),
  ]

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-5 md:px-8 md:py-8">
      <header className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight">{t('고객 상담', 'Customer inquiries')}</h1>
        <p className="mt-1 text-[13px] text-muted">
          {t(`${PRODUCT.name} 소개 페이지에서 들어온 신청입니다. 담당 매니저를 정하고 상담 기록을 남긴 뒤, 계약되면 “고객사 개설”로 그룹·매체·발행인을 한 번에 만듭니다. 확인을 마치면 “확인하고 완료”로 넘기고, 그 뒤 절차(도메인·법정 표기·검색 등록 등)는 개통 현황에서 합니다. 신청일로부터 1년이 지나면 자동으로 지워집니다.`, `Requests submitted through the ${PRODUCT.name} product page. Assign a manager and keep consultation notes; once a contract is signed, use “Open client” to create the group, outlet and publisher in one step. When you have checked everything, move it on with “Confirm and complete”; the steps after that (domain, legal notices, search registration and so on) are handled under Launch status. Requests are deleted automatically one year after they were submitted.`)}
        </p>
      </header>
      <nav className="-mx-1 mb-4 flex gap-1 overflow-x-auto whitespace-nowrap px-1 text-[14px]">
        {tabs.map((tb) => (
          <a key={tb.key} href={`/admin/leads?tab=${tb.key}`} className={`shrink-0 rounded-full px-3 py-1.5 md:px-3.5 ${tab === tb.key ? 'bg-ink font-bold text-white' : 'text-muted hover:text-ink'}`}>
            {tb.label} <span className="tabular-nums opacity-70">{tb.n}</span>
          </a>
        ))}
      </nav>
      {tab === 'trial' && held.length > 0 && (
        <section aria-labelledby="held-title" className="mb-4 rounded-lg border border-danger/30 bg-danger/5 px-5 py-4">
          <h2 id="held-title" className="text-[14.5px] font-bold text-danger">{t(`총관리자 확인을 기다리는 체험 기사 ${held.length}건`, `${held.length} trial ${held.length === 1 ? 'story' : 'stories'} awaiting Super Admin review`)}</h2>
          <p className="mt-1 text-[12.5px] text-muted">{t('발행 전 검사에서 욕설·혐오·선정적 표현이 있을 수 있다고 나온 기사입니다. 열어서 승인하면 발행되고, 반려하거나 지울 수 있습니다.', 'The pre-publication check flagged these stories for possible profanity, hate speech or sensational language. Open one to approve and publish it, or send it back or delete it.')}</p>
          <ul className="mt-3 divide-y divide-danger/15 text-[13.5px]">
            {held.map((h) => (
              <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2">
                <a href={`/articles/${h.id}`} className="font-semibold hover:underline">{h.title}</a>
                <span className="text-[12.5px] text-muted">{h.author?.full_name ?? ''} · {formatDateTime(h.updated_at, lang)}</span>
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
            <table className="table-cards w-full text-[13.5px] md:min-w-[760px]">
              <thead className="bg-paper text-left text-[12.5px] text-muted">
                <tr><th className="px-4 py-2.5">{t('신청일', 'Applied')}</th><th className="px-4 py-2.5">{t('이름', 'Name')}</th><th className="px-4 py-2.5">{t('언론사 · 직함', 'Outlet · Title')}</th><th className="px-4 py-2.5">{t('연락처', 'Contact')}</th><th className="px-4 py-2.5">{t('상태', 'Status')}</th><th className="px-4 py-2.5"></th></tr>
              </thead>
              <tbody>
                {trials.map((tu) => (
                  <tr key={tu.user_id} className="border-t border-line">
                    <td data-label={t('신청일', 'Applied')} className="px-4 py-3 tabular-nums text-muted">{formatDateTime(tu.created_at, lang)}</td>
                    <td className="tc-full px-4 py-3 font-semibold">{tu.name}</td>
                    <td data-label={t('언론사 · 직함', 'Outlet · Title')} className="px-4 py-3">{tu.company}{tu.position ? ` · ${tu.position}` : ''}</td>
                    <td data-label={t('연락처', 'Contact')} className="break-all px-4 py-3"><a href={`tel:${tu.phone ?? ''}`} className="hover:underline">{tu.phone}</a><br /><a href={`mailto:${tu.email ?? ''}`} className="text-muted hover:underline">{tu.email}</a></td>
                    <td data-label={t('상태', 'Status')} className="px-4 py-3">{trialState(tu.user_id)}{checkedAt.get(tu.user_id) && <><br /><span className="text-[12px] text-[#2F6BF0]">{t('5일째 안내 보냄', 'Day-5 message sent')} · {formatDateTime(checkedAt.get(tu.user_id)!, lang)}</span></>}</td>
                    <td className="tc-full px-4 py-3 text-right"><a href={`/support/tickets/new?to=${tu.user_id}`} className="whitespace-nowrap rounded-full border border-line px-3 py-1.5 text-[12.5px] font-semibold hover:border-ink">{t('고객센터로 안내 보내기', 'Send a message via Support')}</a></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded-lg border border-line bg-white px-5 py-16 text-center text-sm text-muted">{t('아직 체험 신청이 없습니다.', 'No trial sign-ups yet.')}</p>
        )
      ) : error ? (
        <p className="rounded-lg border border-draft/40 bg-draft/10 px-5 py-4 text-sm">{t('신청서를 받으려면 Supabase에서', 'To receive requests, run')} <code>supabase/beta-requests.sql</code>{t('을 실행해 주세요.', ' in Supabase.')}</p>
      ) : rows.length ? (
        <ul className="space-y-3">
          {rows.map((l) => (
            <LeadCard key={l.id} lead={l} staff={staff} createdLabel={formatDateTime(l.created_at, lang)} groupName={l.publisher_id ? groupName.get(l.publisher_id) ?? null : null} launch={l.publisher_id ? launchOf(l.publisher_id) : undefined} canDelete={isSuper} />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-line bg-white px-5 py-16 text-center text-sm text-muted">{t('해당하는 상담이 없습니다.', 'No matching inquiries.')}</p>
      )}
    </div>
  )
}
