import type { Metadata } from 'next'
import { currentSite } from '@/lib/public-data'
import PolicyPage, { officer } from '@/components/site/PolicyPage'
import { siteIcon } from '@/lib/sites'
import { policyEffective } from '@/lib/policy-date'

export async function generateMetadata(): Promise<Metadata> {
  const site = await currentSite()
  return { title: `${site.lang === 'en' ? 'Editorial Principles' : '편집원칙'} | ${site.name}`, icons: { icon: siteIcon(site) }, ...(site.indexable ? { robots: { index: true, follow: true } } : {}) }
}

// 편집원칙: 매체가 기사를 만드는 기본 약속. 매체가 실제로 지키는 내용으로 다듬어 쓰도록 안내한다 (편집장 확인 필요)
export default async function EditorialPage() {
  const site = await currentSite()
  const en = site.lang === 'en'
  const o = officer(site, site.legal.editor)
  const aiOn = !!site.aiNotice?.on
  const eff = policyEffective(site, '2026-10-28')

  if (en) {
    return (
      <PolicyPage site={site} slug="editorial" effective={eff}>
        <p>{site.name} reports to inform readers. These are the principles our editors and reporters follow.</p>
        <section>
          <h2>1. Accuracy and sourcing</h2>
          <ul>
            <li>We check facts before publishing and name our sources where we can, such as official statements, government releases and public records.</li>
            <li>When a story is based on a press release, we say so and write the story in our own words.</li>
            <li>Numbers, dates and quotations are taken from the original source.</li>
          </ul>
        </section>
        <section>
          <h2>2. Fairness</h2>
          <ul>
            <li>We try to present the main sides of an issue and give people criticized in a story a chance to respond.</li>
            <li>Opinion pieces are labeled as opinion and kept separate from news reports.</li>
          </ul>
        </section>
        <section>
          <h2>3. Independence from advertising</h2>
          <ul>
            <li>Advertising is kept separate from news. Paid or sponsored content is labeled, and advertisers do not decide what we report.</li>
            <li>We do not publish stories in exchange for payment, and we do not promote products or services as news.</li>
          </ul>
        </section>
        <section>
          <h2>4. How stories are published</h2>
          <ul>
            <li>Stories written by reporters are reviewed and approved by an editor before publication.</li>
            <li>Every story carries the reporter’s name and the time it was published. If we change a story later, the page shows when it was updated.</li>
          </ul>
        </section>
        <section>
          <h2>5. Photos and copyright</h2>
          <ul>
            <li>We credit photographers and sources, and we respect copyright and licenses. Stock or archive photos are labeled as such.</li>
          </ul>
        </section>
        <section>
          <h2>6. Use of AI</h2>
          <ul>
            {aiOn
              ? <li>When AI helps write a story, we tell readers at the end of the story. An editor checks the facts before it is published.</li>
              : <li>When AI helps write a story, we aim to tell readers. An editor checks the facts before it is published.</li>}
          </ul>
        </section>
        <section>
          <h2>7. Corrections</h2>
          <p>If we get something wrong, we correct it. See <a href="/policy/corrections" className="text-brand underline">Corrections and Tips</a>.</p>
        </section>
        <section>
          <h2>Contact</h2>
          <p>{o.name} · {o.contact}</p>
        </section>
      </PolicyPage>
    )
  }

  return (
    <PolicyPage site={site} slug="editorial" effective={eff}>
      <p>{site.name}은(는) 독자에게 사실을 알리기 위해 기사를 씁니다. 편집인과 기자가 지키는 기본 원칙은 다음과 같습니다.</p>
      <section>
        <h2>1. 사실 확인과 출처 표기</h2>
        <ul>
          <li>기사는 사실을 확인한 뒤 발행하고, 가능한 한 출처(정부·공공기관 발표, 보도자료, 공개 자료 등)를 밝힙니다.</li>
          <li>보도자료를 바탕으로 쓴 기사는 그 사실을 밝히고, 문장을 그대로 옮기지 않고 새로 씁니다.</li>
          <li>숫자·날짜·인용은 원문을 기준으로 씁니다.</li>
        </ul>
      </section>
      <section>
        <h2>2. 공정성</h2>
        <ul>
          <li>쟁점이 있는 사안은 주요 입장을 함께 다루고, 비판받는 당사자에게 반론할 기회를 주려고 노력합니다.</li>
          <li>의견·칼럼은 의견임을 밝혀 뉴스 보도와 구분합니다.</li>
        </ul>
      </section>
      <section>
        <h2>3. 광고로부터의 독립</h2>
        <ul>
          <li>광고와 기사는 구분합니다. 광고·협찬 내용은 광고임을 표시하고, 광고주가 기사 내용을 정하지 않습니다.</li>
          <li>대가를 받고 기사를 쓰지 않으며, 상품·서비스 홍보를 뉴스처럼 내보내지 않습니다.</li>
        </ul>
      </section>
      <section>
        <h2>4. 기사가 나가는 과정</h2>
        <ul>
          <li>기자가 쓴 기사는 편집인(편집장)이 확인하고 승인한 뒤 발행하는 것을 원칙으로 합니다.</li>
          <li>모든 기사에 기자 이름과 발행 시각을 표시합니다. 발행 뒤 고친 기사는 수정 시각이 함께 표시됩니다.</li>
        </ul>
      </section>
      <section>
        <h2>5. 사진과 저작권</h2>
        <ul>
          <li>사진·자료의 출처와 촬영자를 밝히고 저작권과 이용 조건을 지킵니다. 자료사진은 자료사진임을 표시합니다.</li>
        </ul>
      </section>
      <section>
        <h2>6. 인공지능(AI) 활용</h2>
        <ul>
          {aiOn
            ? <li>AI를 활용해 쓴 기사에는 기사 끝에 활용 사실을 표시합니다. 편집인이 사실관계를 확인한 뒤 발행합니다.</li>
            : <li>AI를 활용해 쓴 기사는 그 사실을 독자에게 알리는 것을 원칙으로 하고, 편집인이 사실관계를 확인한 뒤 발행합니다.</li>}
        </ul>
      </section>
      <section>
        <h2>7. 오류와 정정</h2>
        <p>잘못이 있으면 바로잡습니다. 방법은 <a href="/policy/corrections" className="text-brand underline">정정·반론·제보</a>를 참고해 주세요.</p>
      </section>
      <section>
        <h2>문의</h2>
        <p>편집인 {o.name} · {o.contact}</p>
      </section>
    </PolicyPage>
  )
}
