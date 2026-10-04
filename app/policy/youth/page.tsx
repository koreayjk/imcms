import type { Metadata } from 'next'
import { currentSite } from '@/lib/public-data'
import PolicyPage, { officer } from '@/components/site/PolicyPage'
import { siteIcon } from '@/lib/sites'

export async function generateMetadata(): Promise<Metadata> {
  const site = await currentSite()
  return { title: `청소년보호정책 | ${site.name}`, icons: { icon: siteIcon(site) } }
}

const EFFECTIVE = '2026년 10월 2일'

// 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」·「청소년 보호법」에 따른 청소년보호정책
export default async function YouthPage() {
  const site = await currentSite()
  const o = officer(site, site.legal.youthOfficer)
  return (
    <PolicyPage site={site} slug="youth" effective={EFFECTIVE}>
      <p>{site.name}은 청소년이 건전한 인격체로 성장할 수 있도록 「정보통신망 이용촉진 및 정보보호 등에 관한 법률」과 「청소년 보호법」에 따라 청소년보호정책을 두고 시행합니다.</p>

      <section>
        <h2>1. 유해정보로부터 청소년 보호</h2>
        <ul>
          <li>청소년에게 유해한 기사·광고·이미지를 싣지 않도록 편집 단계에서 확인합니다.</li>
          <li>청소년 유해 매체물에 해당하는 정보는 게재하지 않으며, 부득이한 경우 청소년 유해 표시를 하고 접근을 제한합니다.</li>
          <li>광고는 게재 전 내용을 확인하고, 청소년에게 유해한 광고는 받지 않습니다.</li>
        </ul>
      </section>

      <section>
        <h2>2. 임직원 교육</h2>
        <p>기자와 편집 담당자에게 청소년 보호 관련 법령과 유해정보 판단 기준을 교육합니다.</p>
      </section>

      <section>
        <h2>3. 상담과 피해 구제</h2>
        <p>청소년 유해정보로 피해를 입었거나 신고할 내용이 있으면 아래 청소년보호책임자에게 연락해 주십시오. 확인 후 지체 없이 조치합니다.</p>
      </section>

      <section>
        <h2>4. 청소년보호책임자</h2>
        <p>성명: {o.name}<br />연락처: {o.contact}</p>
        <p>방송통신심의위원회 불법·유해정보 신고 (www.kocsc.or.kr / 국번 없이 1377)에도 신고할 수 있습니다.</p>
      </section>

      <section>
        <h2>5. 정책의 변경</h2>
        <p>이 정책은 {EFFECTIVE}부터 적용됩니다.</p>
      </section>
    </PolicyPage>
  )
}
