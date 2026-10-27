import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'

// 자료 내보내기 (발행인·총관리자): 기사 전체와 사진을 내려받는다
//   우리 자료는 언제든 우리가 가져갈 수 있어야 한다 — 백업으로 보관하거나, 다른 프로그램으로 옮길 때 그 회사에 넘긴다
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default async function ExportPage(props: { searchParams: Promise<{ outlet?: string }> }) {
  const sp = await props.searchParams
  const { supabase, isSuper, isGroupAdmin, publisherId, outletId: myOutlet, trial } = await getCmsContext()
  if (!isGroupAdmin || trial) redirect('/newsroom')
  const { t, lang } = await getT()
  const num = (n: number) => n.toLocaleString(lang === 'en' ? 'en-US' : undefined)
  const count_ = (n: number) => t(`${num(n)}건`, `${num(n)} ${n === 1 ? 'story' : 'stories'}`)

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
        <nav className="mb-2 text-[12.5px] text-muted"><Link href="/admin/outlets" className="hover:text-ink">{t('매체', 'Outlets')}</Link> / {t('자료 내보내기', 'Export data')}</nav>
        <h1 className="text-[22px] font-bold tracking-tight">{t('자료 내보내기', 'Export data')}</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          {t(
            '우리 매체의 기사와 사진을 언제든 내려받을 수 있습니다. 백업으로 보관하거나, 다른 프로그램으로 옮길 때 그 회사에 이 파일들을 넘기면 됩니다.',
            'You can download your outlet\'s stories and photos at any time. Keep them as a backup, or hand these files to the new vendor when you move to another system.',
          )}{' '}
          {t(
            '내려받은 파일에는 기사 원문이 모두 들어 있으니 안전한 곳에 보관하세요.',
            'The downloaded files contain the full text of every story, so store them somewhere safe.',
          )}
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
        <p className="rounded-lg border border-line bg-white px-5 py-8 text-center text-sm text-muted">{t('내보낼 매체가 없습니다.', 'There are no outlets to export.')}</p>
      ) : (
        <>
          <section className="rounded-lg border border-line bg-white p-5">
            <h2 className="text-[15px] font-bold">{t('1. 기사 전체', '1. All stories')} <span className="text-[12.5px] font-normal text-muted">{current.name} · {count_(total)}</span></h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{t('제목·요약·본문(HTML)·섹션·기자·발행일·태그·대표 사진 주소·조회수를 모두 담습니다. 작성중·승인대기 기사도 들어 있습니다.', 'Includes title, summary, body (HTML), section, reporter, publish date, tags, lead photo URL and view count. Drafts and stories pending approval are included too.')}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={href('json')} className="btn-primary px-4 py-2 text-[13.5px]">{t('기사 전체 내려받기 (JSON)', 'Download all stories (JSON)')}</a>
              <a href={href('csv')} className="btn-secondary px-4 py-2 text-[13.5px]">{t('엑셀로 보기 (CSV)', 'View in Excel (CSV)')}</a>
            </div>
            <p className="mt-2 text-[12px] text-muted">{lang === 'en' ? <>When moving to another system, hand over the <strong>JSON</strong> file (a standard format that software vendors can read easily). The CSV is for checking the list in Excel.</> : <>다른 프로그램으로 옮길 때는 <strong>JSON</strong>을 넘기세요(프로그램 회사들이 읽기 쉬운 표준 형식). CSV는 엑셀에서 목록을 확인하는 용도입니다.</>}</p>
          </section>

          <section className="rounded-lg border border-line bg-white p-5">
            <h2 className="text-[15px] font-bold">{t('2. 사진 (ZIP)', '2. Photos (ZIP)')}</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
              {t(
                '기사에 쓴 사진 파일을 발행 연도별로 묶어 내려받습니다. ZIP 안의 폴더 경로가 기사 속 사진 주소와 같아서, 새 프로그램이 기사와 사진을 그대로 짝지을 수 있습니다.',
                'Photos used in stories are bundled by publication year. The folder paths inside the ZIP match the photo URLs in the stories, so a new system can pair stories and photos as they are.',
              )}{' '}
              {t(
                '사진이 아주 많은 해는 월별로 받으세요(한 번에 5분 안에 만들 수 있는 만큼).',
                'For years with a very large number of photos, download by month (as much as can be built in 5 minutes at a time).',
              )}
            </p>
            {years.length || unpublished ? (
              <ul className="mt-3 divide-y divide-line rounded-md border border-line">
                {years.map((y) => (
                  <li key={y.year} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 text-[13px]">
                    <span className="w-16 font-semibold tabular-nums">{t(`${y.year}년`, String(y.year))}</span>
                    <span className="w-24 text-muted tabular-nums">{t(`기사 ${num(y.count)}건`, count_(y.count))}</span>
                    <a href={href('photos', `&year=${y.year}`)} className="btn-secondary px-3 py-1 text-[12.5px]">{t('사진 ZIP', 'Photo ZIP')}</a>
                    <details className="text-[12px] text-muted">
                      <summary className="cursor-pointer">{t('월별로', 'By month')}</summary>
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                          <a key={m} href={href('photos', `&year=${y.year}&month=${m}`)} className="rounded border border-line px-1.5 py-0.5 tabular-nums hover:border-ink hover:text-ink">{t(`${m}월`, MONTHS_EN[m - 1])}</a>
                        ))}
                      </span>
                    </details>
                  </li>
                ))}
                {unpublished > 0 && (
                  <li className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
                    <span className="w-16 font-semibold">{t('발행 전', 'Unpublished')}</span>
                    <span className="w-24 text-muted tabular-nums">{t(`기사 ${num(unpublished)}건`, count_(unpublished))}</span>
                    <a href={href('photos', '&year=none')} className="btn-secondary px-3 py-1 text-[12.5px]">{t('사진 ZIP', 'Photo ZIP')}</a>
                  </li>
                )}
              </ul>
            ) : (
              <p className="mt-3 text-[13px] text-muted">{t('아직 기사가 없습니다.', 'No stories yet.')}</p>
            )}
          </section>

          <section className="rounded-lg border border-review/30 bg-review/5 p-5 text-[13px] leading-relaxed">
            <h2 className="font-bold">{t('다른 프로그램으로 옮기실 때', 'When moving to another system')}</h2>
            <ul className="mt-1.5 list-disc space-y-1 pl-5">
              <li>{lang === 'en' ? <>Hand the <strong>all-stories file (JSON)</strong> above and the <strong>yearly photo ZIPs</strong> to the vendor of your new system.</> : <>위 <strong>기사 전체(JSON)</strong>와 <strong>연도별 사진 ZIP</strong>을 새 프로그램 회사에 넘기면 됩니다.</>}</li>
              <li>{t('도메인은 우리 언론사 것이라 그대로 가져가실 수 있습니다. 연결을 옮길 때 고객센터에 알려 주시면 도와드립니다.', 'The domain belongs to your outlet, so you can take it with you as is. Let Support know when you move the connection and we will help.')}</li>
              <li>{t('파일을 직접 받기 어려우시면 고객센터에 요청해 주세요. 운영팀이 만들어 드립니다.', 'If you have trouble downloading the files yourself, ask Support and the IM Newsroom team will prepare them for you.')}</li>
            </ul>
          </section>
        </>
      )}
    </div>
  )
}
