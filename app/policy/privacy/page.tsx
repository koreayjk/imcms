import type { Metadata } from 'next'
import { currentSite } from '@/lib/public-data'
import PolicyPage, { officer } from '@/components/site/PolicyPage'
import { siteIcon, type SiteConfig } from '@/lib/sites'

export async function generateMetadata(): Promise<Metadata> {
  const site = await currentSite()
  return { title: `${site.lang === 'en' ? 'Privacy Policy' : '개인정보처리방침'} | ${site.name}`, icons: { icon: siteIcon(site) } }
}

const EFFECTIVE = '2026년 10월 13일'

// 인터넷신문 표준 형태의 개인정보처리방침. 정식 오픈 전 매체 상황에 맞게 법무 검토를 권장한다
export default async function PrivacyPage() {
  const site = await currentSite()
  const o = officer(site, site.legal.publisher)
  if (site.lang === 'en') return <PrivacyEn site={site} o={o} />
  return (
    <PolicyPage site={site} slug="privacy" effective={EFFECTIVE}>
      <p>{site.name}(이하 “신문사”)은 「개인정보 보호법」에 따라 이용자의 개인정보를 보호하고 관련 고충을 신속하게 처리하기 위해 다음과 같이 개인정보처리방침을 둡니다.</p>

      <section>
        <h2>1. 처리하는 개인정보와 목적</h2>
        <p>신문사 홈페이지는 독자 회원가입 없이 이용할 수 있으며, 다음의 경우에만 최소한의 개인정보를 처리합니다.</p>
        <table>
          <thead><tr><th>구분</th><th>항목</th><th>목적</th><th>보유 기간</th></tr></thead>
          <tbody>
            <tr><td>기사제보·광고문의 (이메일)</td><td>이름, 이메일 주소, 연락처, 문의 내용</td><td>제보 확인·취재, 문의 답변</td><td>처리 완료 후 1년</td></tr>
            <tr><td>편집국 회원 (기자·편집인)</td><td>이름, 이메일 주소, 소속 매체, 로그인 기록</td><td>기사 작성·편집·발행, 본인 확인</td><td>탈퇴 시까지 (기사의 기자명은 기사와 함께 보존)</td></tr>
            <tr><td>뉴스레터 구독 (신청한 분만)</td><td>이메일 주소, (선택) 이름, 구독 확인·수신거부 일시</td><td>뉴스레터 발송, 구독 확인</td><td>수신거부할 때까지 (메일마다 수신거부 링크)</td></tr>
            <tr><td>홈페이지 이용 (자동 수집)</td><td>접속 IP, 브라우저 종류, 접속 일시</td><td>서비스 안정 운영, 부정 이용 방지</td><td>최대 1년</td></tr>
          </tbody>
        </table>
        <p>기사 조회수를 중복 없이 세기 위해 이용자 기기의 브라우저 저장소에 “열어 본 기사” 기록을 12시간 동안 남깁니다. 이 기록은 기기에만 저장되며 신문사로 전송되지 않습니다.</p>
      </section>

      <section>
        <h2>2. 개인정보의 제3자 제공</h2>
        <p>신문사는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만 법령에 따라 수사기관 등이 적법한 절차로 요구하는 경우는 예외로 합니다.</p>
      </section>

      <section>
        <h2>3. 처리 위탁과 국외 이전</h2>
        <p>신문사는 홈페이지·편집국 운영을 위해 다음과 같이 업무를 맡기고 있으며, 일부는 국외 서버에 저장됩니다.</p>
        <table>
          <thead><tr><th>받는 자</th><th>맡기는 업무</th><th>이전 국가</th><th>연락처</th></tr></thead>
          <tbody>
            <tr><td>IM America Group Corp (IM 뉴스룸)</td><td>홈페이지·편집국 시스템 운영과 관리 (아래 업체에 다시 맡김)</td><td>미국 법인 (자료 저장은 아래와 같음)</td><td>contact@imnewsroom.com</td></tr>
            <tr><td>Supabase Inc.</td><td>데이터베이스·사진 저장</td><td>일본 (도쿄 데이터센터)</td><td>supabase.com/privacy</td></tr>
            <tr><td>Vercel Inc.</td><td>홈페이지 호스팅·접속 기록</td><td>미국·일본 등</td><td>vercel.com/legal/privacy-policy</td></tr>
            <tr><td>Google LLC</td><td>편집국 회원 구글 계정 로그인</td><td>미국</td><td>policies.google.com/privacy</td></tr>
            <tr><td>Resend, Inc.</td><td>보도자료 메일 수신, 뉴스레터·알림 메일 발송</td><td>미국</td><td>resend.com/legal/privacy-policy</td></tr>
          </tbody>
        </table>
        <p>이전 시기는 서비스 이용 시점이며, 이전 방법은 암호화된 네트워크 전송입니다. 보유 기간은 위 1항과 같습니다. 국외 이전을 원하지 않으면 기사제보는 전화로 해 주시기 바랍니다.</p>
      </section>

      <section>
        <h2>4. 개인정보의 파기</h2>
        <p>보유 기간이 끝나거나 처리 목적을 이루면 지체 없이 파기합니다. 전자 파일은 복구할 수 없는 방법으로 지우고, 종이 문서는 분쇄하거나 소각합니다.</p>
      </section>

      <section>
        <h2>5. 이용자의 권리</h2>
        <p>이용자는 언제든지 자신의 개인정보 열람·정정·삭제·처리정지를 요구할 수 있습니다. 아래 개인정보 보호책임자에게 연락하면 지체 없이 조치합니다.</p>
      </section>

      <section>
        <h2>6. 안전성 확보 조치</h2>
        <ul>
          <li>접근 권한 관리: 편집국은 승인된 회원만, 직급별로 필요한 정보만 볼 수 있도록 제한</li>
          <li>암호화: 모든 접속은 HTTPS로 암호화, 비밀번호는 암호화해 저장</li>
          <li>접속 기록 보관과 보안 업데이트</li>
        </ul>
      </section>

      <section>
        <h2>7. 개인정보 보호책임자</h2>
        <p>성명: {o.name}<br />연락처: {o.contact}</p>
        <p>개인정보 침해에 대한 신고나 상담은 다음 기관에도 할 수 있습니다.</p>
        <ul>
          <li>개인정보침해신고센터 (privacy.kisa.or.kr / 국번 없이 118)</li>
          <li>개인정보분쟁조정위원회 (www.kopico.go.kr / 1833-6972)</li>
          <li>대검찰청 (www.spo.go.kr / 국번 없이 1301)</li>
          <li>경찰청 (ecrm.police.go.kr / 국번 없이 182)</li>
        </ul>
      </section>

      <section>
        <h2>8. 방침의 변경</h2>
        <p>이 방침은 {EFFECTIVE}부터 적용됩니다. 내용이 바뀌면 시행 7일 전부터 홈페이지에 알립니다.</p>
      </section>
    </PolicyPage>
  )
}

// 영문 매체용 (Privacy Policy)
const EFFECTIVE_EN = 'Oct. 14, 2026'
function PrivacyEn({ site, o }: { site: SiteConfig; o: { name: string; contact: string } }) {
  return (
    <PolicyPage site={site} slug="privacy" effective={EFFECTIVE_EN}>
      <p>{site.name} (“we,” “us”) respects your privacy. This policy explains what personal information we process when you read our website, contact us or subscribe to our newsletter, and how we protect it.</p>

      <section>
        <h2>1. Information we process and why</h2>
        <p>You can read {site.name} without creating an account. We process only the minimum information needed in the following cases.</p>
        <table>
          <thead><tr><th>Purpose</th><th>Information</th><th>Use</th><th>Retention</th></tr></thead>
          <tbody>
            <tr><td>News tips and advertising inquiries (email)</td><td>Name, email address, phone number, message</td><td>Verifying tips, reporting, replying to inquiries</td><td>One year after the matter is closed</td></tr>
            <tr><td>Newsroom accounts (reporters and editors)</td><td>Name, email address, outlet, sign-in records</td><td>Writing, editing and publishing stories; identity verification</td><td>Until the account is closed (bylines remain with published stories)</td></tr>
            <tr><td>Newsletter (subscribers only)</td><td>Email address, optional name, confirmation and unsubscribe dates</td><td>Sending the newsletter, confirming subscriptions</td><td>Until you unsubscribe (every email has an unsubscribe link)</td></tr>
            <tr><td>Website use (collected automatically)</td><td>IP address, browser type, time of access</td><td>Keeping the service secure and stable, preventing abuse</td><td>Up to one year</td></tr>
          </tbody>
        </table>
        <p>To count story views without duplicates, your browser stores a list of stories you opened for 12 hours. It stays on your device and is not sent to us.</p>
      </section>

      <section>
        <h2>2. Sharing with third parties</h2>
        <p>We do not sell or share your personal information with third parties, except when required by law, such as a valid request from law enforcement.</p>
      </section>

      <section>
        <h2>3. Service providers and international transfers</h2>
        <p>We use the following providers to run our website and newsroom. Some data is stored on servers outside your country.</p>
        <table>
          <thead><tr><th>Provider</th><th>Service</th><th>Location</th><th>Contact</th></tr></thead>
          <tbody>
            <tr><td>IM America Group Corp (IM Newsroom)</td><td>Operation of the website and newsroom system (through the providers below)</td><td>United States company (storage as below)</td><td>contact@imnewsroom.com</td></tr>
            <tr><td>Supabase Inc.</td><td>Database and photo storage</td><td>Japan (Tokyo data center)</td><td>supabase.com/privacy</td></tr>
            <tr><td>Vercel Inc.</td><td>Website hosting and access logs</td><td>United States, Japan and other regions</td><td>vercel.com/legal/privacy-policy</td></tr>
            <tr><td>Google LLC</td><td>Google sign-in for newsroom accounts</td><td>United States</td><td>policies.google.com/privacy</td></tr>
            <tr><td>Resend, Inc.</td><td>Newsletter and notification emails</td><td>United States</td><td>resend.com/legal/privacy-policy</td></tr>
          </tbody>
        </table>
        <p>Data is transferred over encrypted connections when you use the service and is kept for the periods listed above.</p>
      </section>

      <section>
        <h2>4. Deletion</h2>
        <p>When a retention period ends or the purpose has been fulfilled, we delete the information without delay so that it cannot be recovered.</p>
      </section>

      <section>
        <h2>5. Your rights</h2>
        <p>You may ask at any time to see, correct or delete your personal information, or to stop its processing. Contact the privacy officer below and we will respond promptly.</p>
      </section>

      <section>
        <h2>6. Security</h2>
        <ul>
          <li>Access control: only approved newsroom members can sign in, and each role sees only what it needs.</li>
          <li>Encryption: all connections use HTTPS, and passwords are stored encrypted.</li>
          <li>Access logs are kept and security updates are applied.</li>
        </ul>
      </section>

      <section>
        <h2>7. Privacy officer</h2>
        <p>Name: {o.name}<br />Contact: {o.contact}</p>
      </section>

      <section>
        <h2>8. Changes to this policy</h2>
        <p>This policy takes effect on {EFFECTIVE_EN}. We will post any changes on this page at least seven days before they take effect.</p>
      </section>
    </PolicyPage>
  )
}
