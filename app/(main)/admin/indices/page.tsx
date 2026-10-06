import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { INDEX_INFO, INDEX_KEYS, type IndexKey } from '@/lib/market-index'
import PendingButton from '@/components/cms/PendingButton'
import { clearSampleIndex, deleteIndexPoint, saveIndexPoint } from './actions'

type Row = { index_key: IndexKey; week_date: string; value: number; is_sample: boolean }

// 해운 운임지수 입력: 매주 발표된 SCFI·KCCI 값을 넣으면 홈페이지 위젯에 바로 반영된다
export default async function IndicesPage(props: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const searchParams = await props.searchParams
  const { supabase, outletId, isEditorPlus } = await getCmsContext()
  if (!isEditorPlus || !outletId) redirect('/newsroom')

  const [{ data: outlet }, { data, error }] = await Promise.all([
    supabase.from('outlets').select('name, site').eq('id', outletId).maybeSingle(),
    supabase.from('market_index_points').select('index_key, week_date, value, is_sample').eq('outlet_id', outletId).order('week_date', { ascending: false }).limit(80),
  ])
  const rows = (data ?? []) as Row[]
  const enabled = !!(outlet?.site as { indexWidget?: boolean } | null)?.indexWidget
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)

  return (
    <div className="mx-auto max-w-[900px] px-4 py-5 md:px-8 md:py-8">
      <header className="mb-6">
        <p className="text-[12.5px] text-muted"><Link href="/admin/home" className="hover:text-ink">홈편집</Link> ›</p>
        <h1 className="text-[22px] font-bold tracking-tight">해운 운임지수 <span className="ml-1 text-[15px] font-medium text-muted">{outlet?.name}</span></h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          발표 기관이 공개한 주간 값을 그대로 옮겨 적으세요. 저장하면 홈페이지 오른쪽 위젯에 최근 12주 그래프로 나옵니다.
          값은 반드시 원 발표 자료(기관 누리집·보도자료)에서 확인해 넣고, 다른 매체 기사에서 옮기지 마세요.
        </p>
      </header>

      {!enabled && (
        <p className="mb-5 rounded-lg border border-draft/40 bg-draft/10 px-4 py-3 text-[13px]">이 매체는 홈페이지에 지수 위젯이 꺼져 있습니다. 운영팀에 “홈페이지 설정 → 해운 운임지수 위젯” 켜기를 요청하세요. 값은 미리 넣어 둘 수 있습니다.</p>
      )}
      {error && <p className="mb-5 rounded-lg border border-draft/40 bg-draft/10 px-4 py-3 text-[13px]">지수 기능을 쓰려면 <code>supabase/market-indices.sql</code>을 실행해 주세요.</p>}
      {searchParams.error && <p role="alert" className="mb-5 rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-[13px] text-danger">{searchParams.error}</p>}
      {searchParams.ok && <p role="status" className="mb-5 rounded-lg border border-published/30 bg-published/5 px-4 py-3 text-[13px] text-published">{searchParams.ok}</p>}

      <form action={saveIndexPoint} className="rounded-lg border border-line bg-white p-5">
        <h2 className="text-[15px] font-bold">이번 주 값 넣기</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="text-[12.5px] font-semibold">
            지수
            <select name="index_key" defaultValue="scfi" className="field-input mt-1 py-1.5">
              {INDEX_KEYS.map((k) => <option key={k} value={k}>{INDEX_INFO[k].label} · {INDEX_INFO[k].name}</option>)}
            </select>
          </label>
          <label className="text-[12.5px] font-semibold">
            기준일 (발표일)
            <input type="date" name="week_date" defaultValue={today} required className="field-input mt-1 py-1.5" />
          </label>
          <label className="text-[12.5px] font-semibold">
            값
            <input name="value" inputMode="decimal" required placeholder="예: 1,523.45" className="field-input mt-1 w-36 py-1.5" />
          </label>
          <PendingButton pending="저장 중…" className="btn-publish px-5 py-2">저장</PendingButton>
        </div>
        <ul className="mt-3 space-y-0.5 text-[12px] text-muted">
          {INDEX_KEYS.map((k) => <li key={k}>• {INDEX_INFO[k].label}: {INDEX_INFO[k].source}, {INDEX_INFO[k].schedule}</li>)}
          <li>• 같은 지수·같은 날짜를 다시 저장하면 값이 고쳐집니다.</li>
        </ul>
      </form>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {INDEX_KEYS.map((k) => {
          const list = rows.filter((r) => r.index_key === k)
          return (
            <section key={k} className="rounded-lg border border-line bg-white">
              <h2 className="border-b border-line px-5 py-3 text-[14px] font-bold">{INDEX_INFO[k].label} <span className="text-[12px] font-normal text-muted">{list.length}주</span></h2>
              {list.length ? (
                <ul className="divide-y divide-line text-[13.5px] tabular-nums">
                  {list.slice(0, 20).map((r) => (
                    <li key={r.week_date} className="flex items-center gap-3 px-5 py-2">
                      <span className="w-24 text-muted">{r.week_date.replace(/-/g, '.')}</span>
                      <span className="flex-1 font-semibold">{Number(r.value).toLocaleString('ko-KR', { minimumFractionDigits: 2 })}</span>
                      {r.is_sample && <span className="rounded bg-[#FFF4D6] px-1.5 text-[10.5px] font-bold text-[#8A6100]">샘플</span>}
                      <form action={deleteIndexPoint.bind(null, r.index_key, r.week_date)}>
                        <PendingButton pending="…" confirm={`${INDEX_INFO[k].label} ${r.week_date} 값을 지울까요?`} className="text-[12px] text-muted hover:text-danger">지우기</PendingButton>
                      </form>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-5 py-8 text-center text-[13px] text-muted">아직 넣은 값이 없습니다.</p>
              )}
            </section>
          )
        })}
      </div>

      {rows.some((r) => r.is_sample) && (
        <form action={clearSampleIndex} className="mt-5 text-right">
          <PendingButton pending="지우는 중…" confirm="시험용 샘플 값을 모두 지울까요? 직접 넣은 값은 그대로 둡니다." className="text-[12.5px] text-danger underline underline-offset-2">샘플 값 모두 지우기</PendingButton>
        </form>
      )}
    </div>
  )
}
