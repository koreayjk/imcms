import type { Metadata } from 'next'
import { currentSite } from '@/lib/public-data'
import PolicyPage from '@/components/site/PolicyPage'
import { siteIcon } from '@/lib/sites'

export async function generateMetadata(): Promise<Metadata> {
  const site = await currentSite()
  return { title: `${site.lang === 'en' ? 'No Email Harvesting' : '이메일무단수집거부'} | ${site.name}`, icons: { icon: siteIcon(site) } }
}

export default async function EmailPolicyPage() {
  const site = await currentSite()
  if (site.lang === 'en') {
    return (
      <PolicyPage site={site} slug="email" effective="Oct. 14, 2026">
        <p>{site.name} does not permit the email addresses published on this website to be collected by email-harvesting software or any other automated means. Violators may face legal action under applicable law.</p>
      </PolicyPage>
    )
  }
  return (
    <PolicyPage site={site} slug="email" effective="2026년 10월 2일">
      <p>
        {site.name} 홈페이지에 게시된 이메일 주소가 전자우편 수집 프로그램이나 그 밖의 기술적 장치를 이용해 무단으로 수집되는 것을 거부합니다.
        이를 어기면 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」에 따라 처벌받을 수 있습니다.
      </p>
    </PolicyPage>
  )
}
