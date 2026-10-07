import type { Metadata } from 'next'
import { getCmsContext } from '@/lib/cms'
import { getArticleSidebar, isDemo, siteForOutlet } from '@/lib/public-data'
import SiteFrame from '@/components/site/SiteFrame'
import AdArea from '@/components/site/AdArea'
import ArticleAside from '@/components/site/ArticleAside'
import PreviewArticle from './PreviewArticle'

export const metadata: Metadata = { title: '기사 미리보기', robots: { index: false, follow: false } }

// 기사쓰기 미리보기: 그 매체 홈페이지의 기사 화면과 같은 틀(머리·메뉴·오른쪽·광고·꼬리)에 쓰는 중인 기사를 넣어 보여 준다
export default async function ArticlePreviewPage(props: { searchParams: Promise<{ outlet?: string; c?: string }> }) {
  const searchParams = await props.searchParams
  const outletId = isDemo ? null : (await getCmsContext()).outletId
  const id = /^[0-9a-f-]{36}$/.test(searchParams.outlet ?? '') ? searchParams.outlet! : outletId
  const site = await siteForOutlet(id ?? '')
  const { mostViewed, latest } = await getArticleSidebar(site)
  const sectionNames = Object.fromEntries(site.sections.map((s) => [s.slug, s.name]))

  return (
    <SiteFrame site={site} current={searchParams.c}>
      <div className="mx-auto grid grid-cols-1 max-w-[1200px] gap-12 px-4 py-7 lg:grid-cols-[minmax(0,1fr)_300px] lg:py-10">
        <PreviewArticle siteName={site.name} sectionNames={sectionNames} bottomAd={<AdArea site={site} slot="article_bottom" className="mt-9" />} />
        <ArticleAside site={site} mostViewed={mostViewed} latest={latest} />
      </div>
    </SiteFrame>
  )
}
