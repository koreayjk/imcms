import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import { EXTRA_AI_FEE } from '@/lib/pricing'
import PlanRow, { type PlanRowData } from '@/components/cms/PlanRow'

const WON = 1400

type Overview = { outlet_id: string; outlet_name: string; plan: string | null; lim: number | null; used: number; over_count: number; overage: boolean; cost_usd: number }

// 운영팀: 매체별 요금제와 이번 달 AI 초안 사용량
export default async function AiUsagePage() {
  const { supabase, isStaff } = await getCmsContext()
  const { t, lang } = await getT()
  if (!isStaff) redirect('/newsroom')

  const [{ data, error }, { data: outlets }, { data: groups }] = await Promise.all([
    supabase.rpc('ai_usage_overview'),
    supabase.from('outlets').select('id, publisher_id, ai_monthly_limit'),
    supabase.from('publishers').select('id, name'),
  ])
  const groupName = new Map((groups ?? []).map((g) => [g.id as string, g.name as string]))
  const outletMeta = new Map((outlets ?? []).map((o: any) => [o.id as string, o]))
  const rows: PlanRowData[] = ((data ?? []) as Overview[]).map((r) => {
    const meta = outletMeta.get(r.outlet_id)
    return {
      id: r.outlet_id,
      name: r.outlet_name,
      group: meta?.publisher_id ? groupName.get(meta.publisher_id) ?? null : null,
      plan: r.plan,
      customLimit: meta?.ai_monthly_limit ?? null,
      limit: r.lim,
      overage: r.overage,
      used: r.used,
      overCount: r.over_count,
      costWon: Math.round(Number(r.cost_usd) * WON),
      extraWon: Math.ceil(r.over_count / 100) * EXTRA_AI_FEE,
    }
  })
  const near = rows.filter((r) => r.limit != null && r.used >= r.limit * 0.8)
  const month = new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long' }).format(new Date())

  return (
    <div className="mx-auto max-w-[1080px] px-4 py-5 md:px-8 md:py-8">
      <header className="mb-5">
        <h1 className="text-[22px] font-bold tracking-tight">{t('요금제 · AI 사용량', 'Plans · AI usage')}</h1>
        <p className="mt-1 text-[13px] text-muted">
          {t(`${month} AI 사용량입니다(초안 1번·법적 검수 1번을 각각 1회로 세고, 매달 1일 한국 시간으로 새로 셉니다). 요금제 기본 한도는 베이직 300 · 스탠다드 900 · 프리미엄 2,000회이고, 한도 칸에 숫자를 적으면 그 값이 우선합니다.
          “넘어도 계속”을 끄면 한도를 다 쓴 매체는 다음 달까지 AI 초안·법적 검수를 쓸 수 없습니다(원문 그대로 만들기, 검수 없이 승인신청은 됩니다).`, `AI usage for ${month}. Each AI draft and each legal check counts as one use, and the count resets on the 1st of every month (Korea time). Default plan limits are Basic 300, Standard 900 and Premium 2,000 uses per month; a number entered in the limit field takes priority.
          If “Continue past limit” is off, an outlet that has used up its limit cannot use AI drafts or legal checks until next month (creating a story from the original text and submitting for review without a check still work).`)}
        </p>
      </header>

      {error ? (
        <p className="rounded-lg border border-draft/40 bg-draft/10 px-5 py-4 text-sm">{t('요금제·AI 사용량을 쓰려면 Supabase에서', 'To use plans and AI usage, run')} <code>supabase/ai-usage.sql</code>{t('을 실행해 주세요.', ' in Supabase.')}</p>
      ) : (
        <>
          {near.length > 0 && (
            <p role="status" className="mb-4 rounded-lg border border-draft/40 bg-draft/10 px-5 py-3 text-[13.5px]">
              {t(`한도의 80%를 넘은 매체 ${near.length}곳`, `${near.length} ${near.length === 1 ? 'outlet is' : 'outlets are'} over 80% of the limit`)}: {near.map((r) => `${r.name}(${r.used}/${r.limit})`).join(', ')}. {t('추가 사용·요금제 변경을 안내해 주세요.', 'Let them know about extra usage or changing plans.')}
            </p>
          )}
          <ul className="divide-y divide-line rounded-xl border border-line bg-white">
            {rows.map((r) => <PlanRow key={r.id} row={r} />)}
          </ul>
        </>
      )}
    </div>
  )
}
