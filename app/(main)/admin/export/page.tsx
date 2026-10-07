import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'

// 자료 내보내기 (발행인·총관리자): 기사 전체와 사진을 내려받는다
//   우리 자료는 언제든 우리가 가져갈 수 있어야 한다 — 백업으로 보관하거나, 다른 프로그램으로 옮길 때 그 회사에 넘긴다
export default async function ExportPage(props: { searchParams: Promise<{ outlet?: string }> }) {
  const sp = await props.searchParams
  const { supabase, isSuper, isGroupAdmin, publisherId, outletId: myOutlet, trial } = await getCmsContext()
  if (!isGroupAdmin || trial) redirect('/newsroom')

  let q = supabase.from('outlets').select('id, name, domain, publisher_id').order('created_at')
  if (!isSuper && publisherId) q = q.eq('publisher_id', publisherId)
  const { data: outlets } = await q
  const list = (outlets ?? []) as { id: string; name: string; domain: string | null }[]
  const current = list.find((o) => o.id === sp.outlet) ?? list.find((o) => o.id === myOutlet) ?? list[0]

  // 연도별 발행 기사 수 (사진은 연도별로 나눠 내려받는다)
  let total = 0
  let unpublished = 0
  const years: { year: number; count: number }[] = []
  if (current) {
    const count = (f: (b: any) => any) => f(supabase.from('articles').select('id', { count: 'exact', head: true }).eq('outlet_id', current.id)).then((r: { count: number | null }) => r.count ?? 0)
    const [{ data: first }, all, none] = await Promise.all([
      supabase.from('articles').select('published_at').eq('outlet_id', current.id).not('published_at', 'is', null).order('published_at').limit(1).maybeSingle(),
      count((b) => b),
      count((b) => b.is('published_at', null)),
    ])
    total = all
    unpublished = none
    const from = first?.published_at ? new Date(Date.parse(first.published_at) + 9 * 3_600_000).getUTCFullYear() : null
    const to = new Date(Date.now() + 9 * 3_600_000).getUTCFullYear()
    if (from) {
      const ys = Array.from({ length: to - from + 1 }, (_, i) => to - i)
      const kst = (y: number) => new Date(Date.UTC(y, 0, 1) - 9 * 3_600_000).toISOString()
      const counts = await Promise.all(ys.map((y) => count((b) => b.gte('published_at', kst(y)).lt('published_at', kst(y + 1)))))
      ys.forEach((y, i) => counts[i] && years.push({ year: y, count: counts[i] }))
    }
  }
  const href = (kind: string, extra = '') => `/api/export?outlet=${current?.id}&kind=${kind}${extra}`

  return (
    <div className="mx-auto max-w-[860px] space-y-6 px-4 py-5 md:px-8 md:py-8">
      <header>
        <nav className="mb-2 text-[12.5px] text-muted"><Link href="/admin/outlets" className="hover:text-ink">매체</Link> / 자료 내보내기</nav>
        <h1 className="text-[22px] font-bold tracking-tight">자료 내보내기</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          우리 매체의 기사와 사진을 언제든 내려받을 수 있습니다. 백업으로 보관하거나, 다른 프로그램으로 옮길 때 그 회사에 이 파일들을 넘기면 됩니다.
          내려받은 파일에는 기사 원문이 모두 들어 있으니 안전한 곳에 보관하세요.
        </p>
      </header>

      {list.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {list.map((o) => (
            <Link key={o.id} href={`/admin/export?outlet=${o.id}`} className={`rounded-full border px-3 py-1 text-[13px] ${o.id === current?.id ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:border-ink'}`}>{o.name}</Link>
          ))}
        </div>
      )}

      {!current ? (
        <p className="rounded-lg border border-line bg-white px-5 py-8 text-center text-sm text-muted">내보낼 매체가 없습니다.</p>
      ) : (
        <>
          <section className="rounded-lg border border-line bg-white p-5">
            <h2 className="text-[15px] font-bold">1. 기사 전체 <span className="text-[12.5px] font-normal text-muted">{current.name} · {total.toLocaleString()}건</span></h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">제목·요약·본문(HTML)·섹션·기자·발행일·태그·대표 사진 주소·조회수를 모두 담습니다. 작성중·승인대기 기사도 들어 있습니다.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={href('json')} className="btn-primary px-4 py-2 text-[13.5px]">기사 전체 내려받기 (JSON)</a>
              <a href={href('csv')} className="btn-secondary px-4 py-2 text-[13.5px]">엑셀로 보기 (CSV)</a>
            </div>
            <p className="mt-2 text-[12px] text-muted">다른 프로그램으로 옮길 때는 <strong>JSON</strong>을 넘기세요(프로그램 회사들이 읽기 쉬운 표준 형식). CSV는 엑셀에서 목록을 확인하는 용도입니다.</p>
          </section>

          <section className="rounded-lg border border-line bg-white p-5">
            <h2 className="text-[15px] font-bold">2. 사진 (ZIP)</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
              기사에 쓴 사진 파일을 발행 연도별로 묶어 내려받습니다. ZIP 안의 폴더 경로가 기사 속 사진 주소와 같아서, 새 프로그램이 기사와 사진을 그대로 짝지을 수 있습니다.
              사진이 아주 많은 해는 월별로 받으세요(한 번에 5분 안에 만들 수 있는 만큼).
            </p>
            {years.length || unpublished ? (
              <ul className="mt-3 divide-y divide-line rounded-md border border-line">
                {years.map((y) => (
                  <li key={y.year} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 text-[13px]">
                    <span className="w-16 font-semibold tabular-nums">{y.year}년</span>
                    <span className="w-24 text-muted tabular-nums">기사 {y.count.toLocaleString()}건</span>
                    <a href={href('photos', `&year=${y.year}`)} className="btn-secondary px-3 py-1 text-[12.5px]">사진 ZIP</a>
                    <details className="text-[12px] text-muted">
                      <summary className="cursor-pointer">월별로</summary>
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <a key={m} href={href('photos', `&year=${y.year}&month=${m}`)} className="rounded border border-line px-1.5 py-0.5 tabular-nums hover:border-ink hover:text-ink">{m}월</a>
                        ))}
                      </span>
                    </details>
                  </li>
                ))}
                {unpublished > 0 && (
                  <li className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
                    <span className="w-16 font-semibold">발행 전</span>
                    <span className="w-24 text-muted tabular-nums">기사 {unpublished.toLocaleString()}건</span>
                    <a href={href('photos', '&year=none')} className="btn-secondary px-3 py-1 text-[12.5px]">사진 ZIP</a>
                  </li>
                )}
              </ul>
            ) : (
              <p className="mt-3 text-[13px] text-muted">아직 기사가 없습니다.</p>
            )}
          </section>

          <section className="rounded-lg border border-review/30 bg-review/5 p-5 text-[13px] leading-relaxed">
            <h2 className="font-bold">다른 프로그램으로 옮기실 때</h2>
            <ul className="mt-1.5 list-disc space-y-1 pl-5">
              <li>위 <strong>기사 전체(JSON)</strong>와 <strong>연도별 사진 ZIP</strong>을 새 프로그램 회사에 넘기면 됩니다.</li>
              <li>도메인은 우리 언론사 것이라 그대로 가져가실 수 있습니다. 연결을 옮길 때 고객센터에 알려 주시면 도와드립니다.</li>
              <li>파일을 직접 받기 어려우시면 고객센터에 요청해 주세요. 운영팀이 만들어 드립니다.</li>
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
