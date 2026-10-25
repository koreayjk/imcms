import type { Metadata } from 'next'
import { currentSite } from '@/lib/public-data'
import { siteIcon } from '@/lib/sites'
import SiteFrame from '@/components/site/SiteFrame'
import InquiryForm from '@/components/site/InquiryForm'

export async function generateMetadata(): Promise<Metadata> {
  const site = await currentSite()
  return { title: `${site.lang === 'en' ? 'Advertising inquiry' : '광고문의'} | ${site.name}`, icons: { icon: siteIcon(site) }, robots: { index: false } }
}

export default async function AdInquiryPage() {
  const site = await currentSite()
  const en = site.lang === 'en'
  return (
    <SiteFrame site={site}>
      <div className="mx-auto max-w-[680px] px-4 py-10">
        <h1 className="text-[26px] font-extrabold tracking-[-0.03em]">{en ? 'Advertising inquiry' : '광고문의'}</h1>
        <p className="mt-2 mb-7 text-[14.5px] leading-relaxed text-sub">
          {en ? `Leave your inquiry for ${site.name} and we will reply by email.` : `${site.name}에 광고를 문의해 주세요. 남겨 주신 이메일로 답변드립니다.`}
        </p>
        <InquiryForm en={en} />
      </div>
    </SiteFrame>
  )
}
