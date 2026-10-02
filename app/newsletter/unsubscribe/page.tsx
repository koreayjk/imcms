import type { Metadata } from 'next'
import { currentSite } from '@/lib/public-data'
import SiteFrame from '@/components/site/SiteFrame'
import NewsletterAction from '@/components/site/NewsletterAction'

export const metadata: Metadata = { title: '뉴스레터 수신거부', robots: { index: false, follow: false } }

export default async function Page({ searchParams }: { searchParams: { t?: string } }) {
  const site = await currentSite()
  const token = /^[0-9a-f]{20,64}$/.test(searchParams.t ?? '') ? searchParams.t! : ''
  return (
    <SiteFrame site={site}>
      <div className="mx-auto max-w-[560px] px-4 py-20 text-center">
        <h1 className="text-[24px] font-extrabold tracking-[-0.02em]">{site.name} 뉴스레터 수신거부</h1>
        {token ? (
          <>
            <p className="mt-3 text-[15px] text-sub">아래 버튼을 누르면 이 주소로 더 이상 뉴스레터를 보내지 않습니다.</p>
            <div className="mt-8"><NewsletterAction token={token} mode="unsubscribe" siteName={site.name} /></div>
          </>
        ) : (
          <p className="mt-4 text-[15px] text-sub">링크가 올바르지 않습니다. 메일의 링크를 다시 눌러 주세요.</p>
        )}
      </div>
    </SiteFrame>
  )
}
