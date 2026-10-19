import { notFound, permanentRedirect } from 'next/navigation'
import { currentSite, legacyArticleId } from '@/lib/public-data'

// 팡고링고(pangolingo)에서 옮겨 온 매체의 옛 기사 주소: /ko-kr/articles/838 → /news/새기사
//   옛 주소로 들어오는 독자·검색엔진을 새 기사로 영구 이동(301)시킨다. 옛 번호는 가져올 때 legacy_id 로 남긴다 (data-migration.sql)
//   옮기지 않았거나 없는 번호는 404
export const metadata = { robots: { index: false } }

export default async function PangolingoArticle({ params }: { params: Promise<{ n: string }> }) {
  const { n } = await params
  if (!/^\d{1,12}$/.test(n)) notFound()
  const site = await currentSite()
  const id = await legacyArticleId(site, n)
  if (!id) notFound()
  permanentRedirect(`/news/${id}`)
}
