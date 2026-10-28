import type { Metadata } from 'next'
import { currentSite } from '@/lib/public-data'
import PolicyPage, { officer } from '@/components/site/PolicyPage'
import { siteIcon } from '@/lib/sites'
import { policyEffective } from '@/lib/policy-date'

export async function generateMetadata(): Promise<Metadata> {
  const site = await currentSite()
  return { title: `${site.lang === 'en' ? 'Corrections and Tips' : '정정·반론·제보'} | ${site.name}`, icons: { icon: siteIcon(site) }, ...(site.indexable ? { robots: { index: true, follow: true } } : {}) }
}

// 정정·반론·제보·고충 안내: 오류를 어디로 어떻게 알리는지, 어떻게 처리하는지
export default async function CorrectionsPage() {
  const site = await currentSite()
  const en = site.lang === 'en'
  const o = officer(site, site.legal.editor)
  const mail = site.legal.email
  const eff = policyEffective(site, '2026-10-28')

  if (en) {
    return (
      <PolicyPage site={site} slug="corrections" effective={eff}>
        <p>{site.name} corrects errors and listens to readers. Here is how to reach us and what happens next.</p>
        <section>
          <h2>1. Report an error or ask for a correction or reply</h2>
          <ul>
            <li>Send the story’s web address, the part you believe is wrong, why, and what you are asking us to do{mail ? ` to ${mail}` : ''}. Please include your name and a way to contact you.</li>
            <li>Under the law, people named in a story may also have the right to request a correction, a reply or a follow-up report. This page does not limit those rights.</li>
          </ul>
        </section>
        <section>
          <h2>2. What we do</h2>
          <ul>
            <li>The editor reviews each request and replies to the person who sent it.</li>
            <li>When we find a mistake, we fix the story and the page shows when it was updated. For a significant correction we add a note at the end of the story.</li>
          </ul>
        </section>
        <section>
          <h2>3. Remove a story or personal information</h2>
          <p>If a story contains your personal information or harms your rights, tell us at the address above. We will review the request and answer.</p>
        </section>
        <section>
          <h2>4. Send us a tip</h2>
          <ul>
            <li>Send news tips and documents to {mail || 'the contact in the footer'}. We handle information about sources carefully and do not disclose it without a lawful reason.</li>
          </ul>
        </section>
        <section>
          <h2>Contact</h2>
          <p>{o.name} · {o.contact}</p>
        </section>
      </PolicyPage>
    )
  }

  return (
    <PolicyPage site={site} slug="corrections" effective={eff}>
      <p>{site.name}은(는) 잘못을 바로잡고 독자의 의견을 듣습니다. 알리는 방법과 처리 과정을 안내합니다.</p>
      <section>
        <h2>1. 오류 신고·정정·반론 요청</h2>
        <ul>
          <li>기사 주소, 잘못되었다고 보는 부분과 이유, 요청하는 내용을 적어 {mail ? <>{mail}(으)로</> : '아래 연락처로'} 보내 주세요. 이름과 연락처도 함께 적어 주세요.</li>
          <li>기사에 이름이 나온 분은 관련 법령(「언론중재 및 피해구제 등에 관한 법률」 등)에 따라 정정·반론·추후 보도를 청구할 수 있습니다. 이 안내는 그 권리를 제한하지 않습니다.</li>
        </ul>
      </section>
      <section>
        <h2>2. 처리 과정</h2>
        <ul>
          <li>편집인이 요청을 확인하고, 보내 주신 분께 결과를 알려 드립니다.</li>
          <li>잘못이 확인되면 기사를 고치고, 고친 시각이 기사에 표시됩니다. 중요한 정정은 기사 끝에 정정 내용을 덧붙입니다.</li>
        </ul>
      </section>
      <section>
        <h2>3. 기사 삭제·개인정보 관련 요청</h2>
        <p>기사에 개인정보가 담겨 있거나 권리가 침해되었다고 생각하시면 위 연락처로 알려 주세요. 요청을 검토한 뒤 답변드립니다.</p>
      </section>
      <section>
        <h2>4. 제보</h2>
        <ul>
          <li>뉴스 제보와 자료는 {mail || '하단 연락처'}(으)로 보내 주세요. 제보자 정보는 신중하게 다루며, 법에 따른 사유 없이 밝히지 않습니다.</li>
        </ul>
      </section>
      <section>
        <h2>문의</h2>
        <p>편집인 {o.name} · {o.contact}</p>
      </section>
    </PolicyPage>
  )
}
