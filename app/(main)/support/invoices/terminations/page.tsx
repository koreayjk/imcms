import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import { formatDate, formatDateTime } from '@/lib/format'
import PendingButton from '@/components/cms/PendingButton'
import { cancelTermination, purgeOutlet, terminateOutlet } from './actions'

type OutletRow = { id: string; name: string; domain: string | null; created_at: string; terminated_at?: string | null; terminate_reason?: string | null; purge_after?: string | null }
type PurgeRow = { id: string; outlet_name: string | null; terminated_at: string | null; terminate_reason: string | null; purged_at: string; files_deleted: number }

const kstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10)
const daysUntil = (d: string) => Math.ceil((Date.parse(`${d}T00:00:00+09:00`) - Date.parse(`${kstToday()}T00:00:00+09:00`)) / 864e5)

// 해지 관리 (총관리자): 해지 처리 → 30일 보관(자료 내보내기 가능) → 자료 지우기. 청구서·결제 기록은 5년 남긴다 (약관 제10·11조)
export default async function TerminationsPage(props: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await props.searchParams
  const { supabase, isSuper } = await getCmsContext()
  const { t, lang } = await getT()
  if (!isSuper) redirect('/support')
  const [{ data: outlets }, purgesRes] = await Promise.all([
    supabase.from('outlets').select('*').order('created_at'),
    supabase.from('outlet_purges').select('*').order('purged_at', { ascending: false }).limit(50),
  ])
  const rows = (outlets ?? []) as OutletRow[]
  const missingSql = !!purgesRes.error || (rows.length > 0 && !('terminated_at' in rows[0]))
  const ended = rows.filter((o) => o.terminated_at)
  const active = rows.filter((o) => !o.terminated_at)

  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6 md:px-8 md:py-10">
      <div className="border-b-2 border-ink pb-4">
        <Link href="/support/invoices/auto" className="text-[13px] text-muted hover:text-ink">{t('‹ 자동 청구', '‹ Auto-billing')}</Link>
        <h1 className="mt-1 text-[22px] font-extrabold tracking-tight">{t('해지 관리', 'Cancellations')}</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          {lang === 'en' ? (
            <>
              <b className="text-ink">Canceling</b> a publication immediately stops its auto-billing and autopay. Its website and newsroom data are kept as is for <b className="text-ink">30 days</b> (during which stories and photos can be taken with <Link href="/admin/export" className="underline">Export data</Link>);
              after 30 days, press <b className="text-ink">Delete data</b> here. Deleted data cannot be restored, and invoices and payment records are kept for 5 years together with the publication name.
              Issue refunds from the payment record on the invoice screen, choosing the amount (annual billing: amount paid − months used × monthly fee).
            </>
          ) : (
            <>
              <b className="text-ink">해지 처리</b>하면 그 매체의 자동 청구와 자동결제가 바로 멈춥니다. 홈페이지·편집국 자료는 <b className="text-ink">30일 동안</b> 그대로 두고(그동안 <Link href="/admin/export" className="underline">자료 내보내기</Link>로 기사·사진을 받아 갈 수 있습니다),
              30일이 지나면 여기서 <b className="text-ink">자료 지우기</b>를 누릅니다. 지운 자료는 되살릴 수 없고, 청구서·결제 기록은 매체 이름과 함께 5년 동안 남습니다.
              환불은 청구서 화면의 결제 기록에서 금액을 정해 하세요 (1년 결제: 낸 금액 − 쓴 달 수 × 월 요금).
            </>
          )}
        </p>
      </div>

      {sp.ok && <p role="status" className="mt-4 rounded-lg bg-published/10 px-4 py-3 text-[13.5px] text-published">{sp.ok}</p>}
      {sp.error && <p role="alert" className="mt-4 rounded-lg bg-danger/10 px-4 py-3 text-[13.5px] text-danger">{sp.error}</p>}
      {missingSql && <p className="mt-4 rounded-lg bg-danger/10 px-4 py-3 text-[13.5px] text-danger">{t('Supabase에서 ', 'Run ')}<code>supabase/billing-safety-2.sql</code>{t('을 먼저 실행해 주세요.', ' in Supabase first.')}</p>}

      <h2 className="mt-8 text-[16px] font-bold">{t('해지한 매체', 'Canceled publications')} ({ended.length})</h2>
      {ended.length === 0 ? <p className="mt-2 text-[13.5px] text-muted">{t('없습니다.', 'None.')}</p> : (
        <ul className="mt-3 space-y-3">
          {ended.map((o) => {
            const left = o.purge_after ? daysUntil(o.purge_after) : null
            const due = left != null && left <= 0
            return (
              <li key={o.id} className="rounded-2xl bg-white p-5 ring-1 ring-black/5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[15px] font-bold">{o.name}</h3>
                  {o.domain && <span className="break-all text-[12.5px] text-muted">{o.domain}</span>}
                  <span className={`rounded px-2 py-0.5 text-[12px] font-semibold ${due ? 'bg-danger/10 text-danger' : 'bg-draft/15 text-draft'}`}>
                    {due ? t('지울 날 지남', 'Deletion date passed') : t(`지울 날까지 D-${left}`, `${left} ${left === 1 ? 'day' : 'days'} until deletion`)}
                  </span>
                </div>
                <p className="mt-1.5 text-[13px] text-muted">
                  {formatDateTime(o.terminated_at!, lang)} {t('해지', 'canceled')} · {t('사유', 'Reason')}: {o.terminate_reason || '-'} · {t('지우는 날', 'Deletion date')} {o.purge_after ? formatDate(o.purge_after, lang) : '-'}
                </p>
                <div className="mt-3 flex flex-wrap items-end gap-3">
                  <form action={cancelTermination.bind(null, o.id)}>
                    <PendingButton pending="…" confirm={t(`${o.name} 해지를 취소할까요?`, `Reverse the cancellation of ${o.name}?`)} className="btn-secondary bg-white">{t('해지 취소', 'Reverse cancellation')}</PendingButton>
                  </form>
                  {due && (
                    <form action={purgeOutlet.bind(null, o.id)} className="flex flex-wrap items-end gap-2">
                      <label className="text-[12.5px]">
                        <span className="mb-1 block text-muted">{t('확인: 매체 이름 그대로 적기', 'Confirm: type the publication name exactly')}</span>
                        <input name="confirm_name" placeholder={o.name} className="field-input w-48 py-1.5 text-[13px]" autoComplete="off" />
                      </label>
                      <PendingButton pending={t('지우는 중…', 'Deleting…')} confirm={t(`${o.name}의 기사·사진·설정·회원 소속을 모두 지웁니다. 되살릴 수 없습니다. 계속할까요?`, `This deletes all stories, photos, settings and member assignments of ${o.name}. It cannot be restored. Continue?`)} className="btn-secondary bg-white text-danger">{t('자료 지우기', 'Delete data')}</PendingButton>
                    </form>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <h2 className="mt-10 text-[16px] font-bold">{t('운영 중인 매체', 'Active publications')}</h2>
      <ul className="mt-3 divide-y divide-line rounded-2xl bg-white ring-1 ring-black/5">
        {active.map((o) => (
          <li key={o.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <span className="min-w-[10rem] flex-1 text-[14px] font-semibold">{o.name}<span className="ml-2 break-all text-[12.5px] font-normal text-muted">{o.domain ?? ''}</span></span>
            <form action={terminateOutlet.bind(null, o.id)} className="flex flex-wrap items-center gap-2">
              <input name="reason" placeholder={t('해지 사유 (예: 고객 요청)', 'Reason (e.g. customer request)')} maxLength={300} className="field-input w-56 py-1.5 text-[13px]" />
              <PendingButton pending="…" confirm={t(`${o.name}을(를) 해지 처리할까요? 자동 청구·자동결제가 멈추고 30일 뒤 자료를 지울 수 있게 됩니다.`, `Cancel ${o.name}? Auto-billing and autopay stop, and its data can be deleted after 30 days.`)} className="btn-secondary bg-white text-danger">{t('해지 처리', 'Cancel publication')}</PendingButton>
            </form>
          </li>
        ))}
      </ul>

      {(purgesRes.data ?? []).length > 0 && (
        <>
          <h2 className="mt-10 text-[16px] font-bold">{t('자료를 지운 매체', 'Publications with data deleted')}</h2>
          <ul className="mt-3 divide-y divide-line rounded-2xl bg-white text-[13px] ring-1 ring-black/5">
            {((purgesRes.data ?? []) as PurgeRow[]).map((p) => (
              <li key={p.id} className="px-5 py-2.5">
                <b>{p.outlet_name}</b> · {p.terminated_at ? `${formatDate(p.terminated_at, lang)} ${t('해지', 'canceled')}` : ''} · {formatDateTime(p.purged_at, lang)} {t('지움', 'deleted')} · {t(`사진 ${p.files_deleted}개`, `${p.files_deleted} ${p.files_deleted === 1 ? 'photo' : 'photos'}`)}
                {p.terminate_reason && <span className="text-muted"> · {p.terminate_reason}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
