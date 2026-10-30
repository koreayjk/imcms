import Link from 'next/link'
import { ISSUER, PRODUCT } from '@/lib/product'
import { HELP_VIDEOS_NOTE_EN, readyVideos, posterOf } from '@/lib/help-videos'
import { listGuideVideos, guideVideoUrls } from '@/lib/guide-videos'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import HelpVideoCard from '@/components/cms/HelpVideoCard'

const GUIDES = [
  { title: '기사 작성 가이드', body: '네이버 뉴스제휴 운영평가 기준에 맞춘 바이라인·보도자료 섹션·중복 기사·제목·사진 출처 원칙과 발행 전 체크리스트입니다. 24개월 누적 10점이면 제휴 해지가 권고되니 꼭 읽어 주세요.', href: '/support/guide', cta: '가이드 보기' },
  { title: '기사 쓰고 발행하기', body: '기사쓰기 → 저장(작성중) → 승인신청 → 편집장이 확인 후 발행. 편집장은 “바로 발행”도 할 수 있습니다.', href: '/articles/new', cta: '기사쓰기' },
  { title: '보도자료로 기사 만들기', body: '보도자료함에서 자료를 열고 “원문 그대로” 또는 “AI 초안”을 누르면 기사 초안이 만들어집니다. 발행 전 원문과 꼭 대조하세요.', href: '/press', cta: '보도자료함' },
  { title: '내 메일로 온 보도자료 받기', body: '지메일 필터로 보도자료만 전용 주소로 전달하면 보도자료함에 자동으로 들어옵니다. 프리미엄은 기본 포함, 베이직·스탠다드는 부가 서비스(월 39,000원, 처음 3통 무료 체험)입니다.', href: '/press/email', cta: '메일로 받기 설정' },
  { title: '홈페이지 첫 화면 배치', body: '편집장은 홈편집에서 헤드라인·톱·주요 기사 자리를 직접 정합니다.', href: '/admin/home', cta: '홈편집' },
  { title: '기자명·내 이름 바꾸기', body: '기사마다 기자명을 따로 적을 수 있고, 내 정보에서 회원 이름을 바꿀 수 있습니다.', href: '/account', cta: '내 정보' },
  { title: '여러 매체에 함께 송고', body: '기사 편집 화면 아래 “함께 송고할 매체”를 고르고 발행하면 다른 매체에도 올라갑니다.', href: '/articles', cta: '기사목록' },
]

const FAQ = [
  { q: '요청한 일은 언제 처리되나요?', a: '업무요청은 영업일 기준 순서대로 확인합니다. 오류·장애는 먼저 처리합니다. 답변이 달리면 고객센터 홈과 업무요청 목록에 “새 답변”이 표시됩니다.' },
  { q: '기자 계정은 어떻게 늘리나요?', a: '새 기자가 로그인 화면에서 회원가입(구글 계정 가능)을 하면, 관리자 승인 후 바로 쓸 수 있습니다.' },
  { q: '청구서는 어디서 보고 어떻게 결제하나요?', a: '편집장 이상 계정으로 고객센터 → 청구서에서 월별로 보고 PDF로 저장할 수 있습니다. 청구서의 “결제하기”를 누르면 국내 카드(신한·현대·삼성 등)·카카오페이·네이버페이·구글페이로 결제되고 영수증이 남습니다. 결제 정보에서 결제수단을 등록하면 다음부터 자동으로 결제됩니다.' },
  { q: '세금계산서를 받을 수 있나요?', a: 'IM 뉴스룸은 미국 법인이 운영해 한국 세금계산서는 발행되지 않습니다. 카드·간편결제 영수증으로 비용 처리할 수 있으니, 자세한 처리는 담당 세무사와 확인해 주세요.' },
  { q: '비밀번호를 잊었어요.', a: '로그인 화면의 비밀번호 칸 오른쪽 “비밀번호 찾기”를 누르고 가입한 이메일을 넣으면 재설정 메일이 옵니다. 메일의 버튼을 눌러 새 비밀번호를 정하면 바로 편집국으로 들어갑니다(링크는 1시간 동안 한 번만 쓸 수 있습니다). 2단계 인증을 켰다면 인증 앱의 6자리 코드도 넣어야 합니다. 구글로 가입했다면 비밀번호 없이 구글 로그인을 쓰면 됩니다.' },
  { q: '네이버·구글 검색에 우리 기사가 나오게 하려면 무엇을 해야 하나요?', a: '따로 하실 일은 없습니다. IM 뉴스룸 운영팀이 개통할 때 운영 계정으로 네이버 서치어드바이저·구글 서치콘솔에 매체 주소를 등록하고, 소유 확인과 사이트맵·RSS 제출까지 대신 해 드립니다(세팅비에 포함). 등록 뒤 검색 결과에 나오기까지 보통 며칠에서 2주 걸립니다.' },
  { q: '우리 매체의 검색 성적(검색어·클릭 수)을 직접 볼 수 있나요?', a: '네. 구글 서치콘솔은 대표님(또는 원하시는 분)의 구글 계정을 “소유자”로 추가해 드립니다. 업무요청에 추가할 구글 이메일을 적어 주세요. 네이버 서치어드바이저 기록이 필요하면 업무요청으로 말씀해 주시면 확인해 드리거나 대표님 아이디로 볼 수 있게 안내해 드립니다.' },
  { q: '왜 언론사 아이디가 아니라 운영팀 계정으로 등록하나요?', a: '매체마다 따로 해야 하는 작업이라 운영팀이 한 계정으로 모아 관리해야 오류 알림을 바로 받고 빨리 고칠 수 있습니다. 홈페이지 주인 확인일 뿐이라 기사·도메인의 소유가 바뀌지 않고, 언론사 자료에 접근하는 권한도 생기지 않습니다.' },
  { q: '네이버 “뉴스” 탭에도 우리 기사가 나오나요?', a: '서치어드바이저 등록은 네이버 웹문서·통합검색까지입니다. 뉴스 탭에 언론사로 나오려면 언론사가 직접 네이버(·카카오) 뉴스 검색제휴 심사를 신청해 통과해야 합니다. 심사에 필요한 뉴스 사이트맵·기사 표기 같은 기술 준비는 되어 있고, 신청 서류 준비가 궁금하면 업무요청으로 물어봐 주세요.' },
  { q: '해지하거나 도메인을 바꾸면 검색 등록은 어떻게 되나요?', a: '도메인을 바꾸면 운영팀이 새 주소로 다시 등록하고 옛 주소에서 새 주소로 연결합니다. 해지하면 구글은 대표님 계정이 이미 소유자라 그대로 이어서 쓰시면 되고, 네이버는 대표님 아이디로 다시 등록하는 방법을 안내해 드립니다. 도메인은 언론사 것입니다.' },
  { q: '업무요청에 비밀번호를 적어도 되나요?', a: '적지 마세요. 계정 정보가 꼭 필요하면 요청에 “전화로 알려드리겠다”고 남겨 주시면 연락드립니다.' },
]

const GUIDES_EN = [
  { title: 'Story writing guide', body: 'Principles for bylines, the press release section, duplicate stories, headlines and photo credits that match the Naver News partnership evaluation criteria, plus a pre-publication checklist. Reaching 10 cumulative points over 24 months leads to a recommendation to terminate the partnership, so please read it.', href: '/support/guide', cta: 'View guide' },
  { title: 'Writing and publishing a story', body: 'Write a story → save (draft) → submit for review → the Editor-in-Chief reviews and publishes. Editors-in-Chief can also “Publish now”.', href: '/articles/new', cta: 'Write a story' },
  { title: 'Turning a press release into a story', body: 'Open a press release in the Press releases inbox and press “As is” or “AI draft” to create a story draft. Always check it against the original before publishing.', href: '/press', cta: 'Press releases' },
  { title: 'Receiving press releases from your email', body: 'Use a Gmail filter to forward only press releases to a dedicated address and they arrive in the Press releases inbox automatically. Included with Premium; an add-on for Basic and Standard (KRW 39,000/month, first 3 emails free to try).', href: '/press/email', cta: 'Email intake setup' },
  { title: 'Arranging the home page', body: 'Editors-in-Chief choose the headline, top story and featured story slots themselves in Edit Home.', href: '/admin/home', cta: 'Edit Home' },
  { title: 'Bylines and changing your name', body: 'You can enter a different byline on each story, and change your member name under My account.', href: '/account', cta: 'My account' },
  { title: 'Publishing to several publications', body: 'Choose the publications to “Also publish to” below the story editor and publish; the story is posted to the other publications too.', href: '/articles', cta: 'Stories' },
]

const FAQ_EN = [
  { q: 'When will my request be handled?', a: 'We review support requests in order, on business days. Errors and outages come first. When a reply is posted, “New reply” appears on the Support home and in your request list.' },
  { q: 'How do I add reporter accounts?', a: 'A new reporter signs up on the login screen (a Google account works). Once an administrator approves them, they can start using the newsroom right away.' },
  { q: 'Where do I see invoices and how do I pay?', a: 'Accounts at Editor-in-Chief level or above can view invoices by month under Support → Invoices and save them as PDF. Press “Pay” on an invoice to pay with a Korean domestic card (Shinhan, Hyundai, Samsung, etc.), KakaoPay, Naver Pay or Google Pay, and a receipt is kept. If you register a payment method under Billing info, future invoices are paid automatically.' },
  { q: 'Can I get a tax invoice?', a: 'IM Newsroom is operated by a U.S. company, so Korean tax invoices are not issued. You can expense the fee with your card or digital-wallet receipt; please confirm the details with your tax accountant.' },
  { q: 'I forgot my password.', a: 'On the login screen, press “Forgot password” to the right of the password field and enter the email you signed up with, and a reset email will arrive. Press the button in the email and set a new password to go straight into the newsroom (the link works once and expires in 1 hour). If you turned on two-step verification, you also need the 6-digit code from your authenticator app. If you signed up with Google, just use Google login; no password is needed.' },
  { q: 'What do I need to do to get our stories into Naver and Google search?', a: 'Nothing. When the IM Newsroom team launches your site, we register your site address in Naver Search Advisor and Google Search Console from our operating accounts, and handle ownership verification and sitemap/RSS submission for you (included in the setup fee). After registration, it usually takes a few days to two weeks for pages to show up in search results.' },
  { q: 'Can I see our outlet’s search performance (queries and clicks) myself?', a: 'Yes. For Google Search Console, we add your Google account (or the account of anyone you choose) as an “owner”. Put the Google email address to add in a support request. If you need Naver Search Advisor records, ask in a support request and we will check them for you or show you how to view them with your own Naver ID.' },
  { q: 'Why is the site registered under the team’s account instead of the outlet’s?', a: 'Registration is separate work for every outlet, and the team can only get error alerts right away and fix problems quickly if it manages them from one account. It only confirms who runs the website, so ownership of your stories and domain does not change, and it gives no access to your outlet’s data.' },
  { q: 'Will our stories also appear in the Naver “News” tab?', a: 'Search Advisor registration covers Naver web documents and integrated search only. To appear as a news outlet in the News tab, the outlet must apply for and pass the Naver (and Kakao) news search partnership review itself. The technical preparation the review needs, such as the news sitemap and story markup, is already in place; if you want to know how to prepare the application documents, ask us in a support request.' },
  { q: 'What happens to our search registration if we cancel or change domains?', a: 'If you change domains, the team registers the new address again and redirects the old address to the new one. If you cancel, your Google account is already an owner, so you can keep using it as is, and we will show you how to register again with your own ID for Naver. The domain belongs to the outlet.' },
  { q: 'Can I put a password in a support request?', a: 'Please do not. If account details are really needed, write in the request that you will share them by phone and we will contact you.' },
]

export default async function HelpPage() {
  const [{ isStaff }, uploaded] = await Promise.all([getCmsContext(), listGuideVideos()])
  const { t, lang } = await getT()
  const videos = readyVideos(new Set(uploaded.map((u) => u.id)), lang)
  const guides = lang === 'en' ? GUIDES_EN : GUIDES
  const faq = lang === 'en' ? FAQ_EN : FAQ
  const urls = await guideVideoUrls(videos.filter((v) => v.own).map((v) => v.id))
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-[22px] font-extrabold tracking-tight">{t('이용안내', 'Help & guides')}</h1>
      {(videos.length > 0 || isStaff) && (
        <section id="videos" className="mt-6 scroll-mt-6">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-[18px] font-extrabold">{t('영상으로 배우기', 'Learn by video')}</h2>
            {isStaff && <Link href="/admin/guide-videos" className="rounded-full border border-line px-3 py-0.5 text-[12px] text-muted hover:border-ink hover:text-ink">{t('영상 올리기·바꾸기 (운영팀)', 'Upload or replace videos (team)')}</Link>}
          </div>
          <p className="mt-1 text-[13.5px] text-muted">{t('처음 쓰시는 분은 위에서부터 차례로 보세요. 영상마다 1~5분입니다.', 'If you are new, watch them in order from the top. Each video is 1 to 5 minutes.')}{lang === 'en' && ` ${HELP_VIDEOS_NOTE_EN}`}</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videos.map((v, i) => <HelpVideoCard key={v.id} n={i + 1} title={v.title} desc={v.desc} videoId={v.videoId} src={v.own ? urls[v.id] : undefined} poster={posterOf(v.id)} link={v.link} shareId={v.id} />)}
          </div>
        </section>
      )}
      <h2 className="mt-12 text-[18px] font-extrabold">{t('글로 보는 안내', 'Written guides')}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {guides.map((g) => (
          <div key={g.title} className="flex flex-col rounded-2xl bg-white p-6 ring-1 ring-black/5">
            <p className="text-[16px] font-bold">{g.title}</p>
            <p className="mt-2 flex-1 text-[14px] leading-relaxed text-[#3B4048]">{g.body}</p>
            <Link href={g.href} className="mt-4 w-fit text-[13.5px] font-semibold text-[#2F6BF0] hover:underline">{g.cta} →</Link>
          </div>
        ))}
      </div>

      <h2 className="mt-12 text-[18px] font-extrabold">{t('자주 묻는 질문', 'Frequently asked questions')}</h2>
      <div className="mt-4 space-y-2">
        {faq.map((f) => (
          <details key={f.q} className="group rounded-xl bg-white px-5 py-4 ring-1 ring-black/5">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
              <span><span className="mr-2 text-[#E5483A]">Q.</span>{f.q}</span>
              <span className="text-muted transition-transform group-open:rotate-45" aria-hidden>+</span>
            </summary>
            <p className="mt-2 pl-6 text-[14px] leading-relaxed text-[#3B4048]">{f.a}</p>
          </details>
        ))}
      </div>

      <section id="contact" className="mt-12 scroll-mt-6 rounded-2xl bg-[#0B1020] p-5 text-white sm:p-8">
        <h2 className="text-[18px] font-extrabold">{lang === 'en' ? `${PRODUCT.nameEn} team contact` : `${PRODUCT.name} 운영팀 연락처`}</h2>
        <div className="mt-4 grid gap-4 text-[14px] sm:grid-cols-2">
          <div>
            <p className="text-white/60">{t('가장 빠른 방법', 'Fastest way')}</p>
            <Link href="/support/tickets/new" className="mt-1 inline-block rounded-full bg-[#2F6BF0] px-5 py-2 font-bold">{t('업무요청 쓰기', 'New support request')}</Link>
          </div>
          <div>
            <p className="text-white/60">{t('전화 · 이메일', 'Phone · Email')}</p>
            <p className="mt-1">{ISSUER.contact ?? t('운영팀 연락처는 곧 안내합니다.', 'Team contact details are coming soon.')}</p>
          </div>
        </div>
      </section>
    </div>
  )
}
