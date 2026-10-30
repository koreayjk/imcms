// 고객센터 → 이용안내 "영상으로 배우기" 목록. 순서가 곧 화면 순서(처음 쓰는 사람이 먼저 해야 할 일 순)
//   영상은 두 가지로 보여 줄 수 있다. ① 회원 전용 저장소(운영팀이 /admin/guide-videos 에서 id.mp4 로 올림)가 먼저, ② 없으면 youtube 칸의 유튜브 영상.
//   둘 다 없는 영상은 화면에 나오지 않는다. 대표 사진은 public/help-videos/id.jpg
export type HelpVideo = {
  id: string
  title: string
  desc: string
  // 유튜브 주소(youtu.be/…, youtube.com/watch?v=…) 또는 11자리 영상 번호
  youtube?: string
  // 영상 설명 아래에 걸어 줄 편집국 화면
  link?: { label: string; href: string }
}

export const HELP_VIDEOS: HelpVideo[] = [
  { id: 'launch', title: '개통까지의 순서', desc: '신청부터 도메인 연결, 검색 등록, 오픈까지 개통이 어떤 순서로 진행되는지 한눈에 봅니다.', link: { label: '개통 현황', href: '/support/onboarding' } },
  { id: 'start', title: '처음 시작하기: 로그인과 화면 둘러보기', desc: '초대 메일로 가입하고 로그인한 뒤, 편집국 메뉴가 무엇인지 한 번에 훑어봅니다.', youtube: 'U7h_uSZf1Jg', link: { label: '뉴스룸으로', href: '/newsroom' } },
  { id: 'security', title: '내 정보와 보안: 비밀번호·2단계 인증', desc: '이름 바꾸기, 비밀번호 바꾸기, 2단계 인증(인증 앱) 켜는 방법입니다.', youtube: 'NRgUmOFRpAI', link: { label: '내 정보', href: '/account' } },
  { id: 'members', title: '기자·편집장 초대하고 직급 정하기', desc: '새 기자를 초대하고, 승인하고, 기자·편집장 직급을 정하는 방법입니다.', youtube: '6Kgk4xIuqpU', link: { label: '회원 관리', href: '/admin/users' } },
  { id: 'write', title: '기사 쓰고 승인신청·발행하기', desc: '기사쓰기 → 저장 → 승인신청 → 편집장 발행까지의 기본 흐름입니다.', youtube: 't8t-SgKtW7Y', link: { label: '기사쓰기', href: '/articles/new' } },
  { id: 'press', title: '보도자료로 기사 만들기 (AI 초안·법적 검수)', desc: '보도자료함에서 AI 초안을 만들고, 발행 전 법적 검수를 받는 방법입니다. 메일로 받은 보도자료는 첨부파일(PDF·한글·워드·텍스트) 내용도 AI 초안이 함께 읽습니다.', youtube: 'sRRRRIm1P8Y', link: { label: '보도자료함', href: '/press' } },
  { id: 'guide', title: '발행 전에 꼭 볼 것: 기사 작성 가이드 핵심', desc: '네이버 뉴스제휴 평가 기준에 맞춘 제목·바이라인·사진 출처 규칙을 짚어 봅니다.', youtube: '81CcaV6wdyw', link: { label: '작성 가이드', href: '/support/guide' } },
  { id: 'photos', title: '기사에 사진 넣고 저장 파일 쓰기', desc: '사진을 올리고, 설명을 달고, 저장 파일에서 다시 가져다 쓰는 방법입니다.', youtube: 'eJzR1GVs_2I', link: { label: '저장 파일', href: '/media' } },
  { id: 'approve', title: '편집장: 승인·반려와 일괄 승인', desc: '승인신청된 기사를 확인하고 한꺼번에 발행하거나 반려하는 방법입니다.', youtube: 'mijfdXVCkZM', link: { label: '기사목록', href: '/articles' } },
  { id: 'home', title: '홈 편집으로 첫 화면 배치하기', desc: '헤드라인·톱·주요 기사 자리를 직접 정하는 방법입니다.', youtube: 'TlujxxKRqss', link: { label: '홈편집', href: '/admin/home' } },
  { id: 'sections', title: '섹션(메뉴) 정리하기', desc: '섹션을 만들고 순서를 바꾸고, 하위 섹션을 묶는 방법입니다.', youtube: 'AtQUzJoWYI4', link: { label: '섹션', href: '/admin/categories' } },
  { id: 'settings', title: '설정: 로고·색·탭 아이콘·공유 사진·로고 띠', desc: '홈페이지에 나오는 이름·슬로건·로고·대표 색, 탭 아이콘과 공유 미리보기 사진, 하단의 로고 띠와 필수 표시 정보를 직접 바꾸는 방법입니다.', link: { label: '설정', href: '/admin/settings' } },
  { id: 'ads', title: '첫 화면 광고 올리기와 예약 광고', desc: '배너 광고를 올리고, 기간을 정해 예약 광고를 거는 방법입니다.', youtube: '8RJupy37b2I', link: { label: '광고', href: '/admin/ads' } },
  { id: 'ads2', title: '광고 새 기능: 자리 설정·순서 끌기·광고문의', desc: '쓰지 않는 광고 자리 끄기, 오른쪽 광고 개수 정하기, 배너를 끌어서 순서·자리 바꾸기, 광고주 문의에 답하는 방법입니다.', link: { label: '광고', href: '/admin/ads' } },
  { id: 'billing', title: '청구서 확인과 카드 등록(자동결제)', desc: '결제 정보를 입력하고, 청구서 메일의 결제하기로 로그인 없이 결제하고, 자동결제(매월 1일 오전 10시)와 청구서 확인·PDF 저장까지 한 번에 봅니다.', youtube: 'HKvkspHjPXo', link: { label: '결제 정보', href: '/support/billing' } },
  { id: 'newsletter', title: '뉴스레터 보내기', desc: '구독자에게 기사 모음을 메일로 보내는 방법입니다.', youtube: 'S1XK6JAM49o', link: { label: '뉴스레터', href: '/admin/newsletter' } },
  { id: 'support', title: '업무요청과 고객센터 이용하기', desc: '수정이나 문의를 업무요청으로 남기고, 답변과 공지를 확인하는 방법입니다.', youtube: 'HXyETgJWYBE', link: { label: '업무요청', href: '/support/tickets/new' } },
  { id: 'pressmail-gmail', title: '지메일 보도자료를 보도자료함으로 자동 받기', desc: '지메일 필터로 보도자료 메일만 전용 주소로 전달해 보도자료함에 자동으로 쌓이게 하는 방법입니다. 이 기능은 프리미엄은 기본 포함, 베이직·스탠다드는 부가 서비스(월 39,000원, 처음 3통 무료 체험)입니다.', link: { label: '메일로 받기 설정', href: '/press/email' } },
  { id: 'pressmail-gmail-detail', title: '지메일 자동 받기 자세히 (화면 따라하기)', desc: '전달 주소 추가, 확인 링크, 필터 만들기까지 화면을 하나씩 따라 하며 설정합니다. 이 기능은 프리미엄은 기본 포함, 베이직·스탠다드는 부가 서비스(월 39,000원, 처음 3통 무료 체험)입니다.', link: { label: '메일로 받기 설정', href: '/press/email' } },
  { id: 'pressmail-other', title: '네이버·다음·회사 메일 보도자료 자동 받기', desc: '지메일이 아닌 메일에서 보도자료를 자동으로 전달받는 방법입니다. 이 기능은 프리미엄은 기본 포함, 베이직·스탠다드는 부가 서비스(월 39,000원, 처음 3통 무료 체험)입니다.', link: { label: '메일로 받기 설정', href: '/press/email' } },
]

// 영어 화면용 제목·설명·연결 이름 (id 로 짝을 맞춘다). 영상은 모두 한국어 음성이다 → 영어 안내에 한 줄로 밝힌다 (HELP_VIDEOS_NOTE_EN)
export const HELP_VIDEOS_NOTE_EN = 'Videos are narrated in Korean.'
const ADDON_EN = 'Included with Premium; an add-on for Basic and Standard (KRW 39,000/month, first 3 emails free to try).'
export const HELP_VIDEOS_EN: Record<string, { title: string; desc: string; linkLabel?: string }> = {
  launch: { title: 'How launch works, step by step', desc: 'See at a glance how launch proceeds, from application and domain connection to search registration and going live.', linkLabel: 'Launch status' },
  start: { title: 'Getting started: signing in and a tour of the screen', desc: 'Sign up from the invitation email, log in, and get a quick tour of what each newsroom menu does.', linkLabel: 'Go to the newsroom' },
  security: { title: 'Your account and security: password and two-step verification', desc: 'How to change your name and password and turn on two-step verification (authenticator app).', linkLabel: 'My account' },
  members: { title: 'Inviting reporters and editors and setting roles', desc: 'How to invite a new reporter, approve them, and set their role as Reporter or Editor-in-Chief.', linkLabel: 'Members' },
  write: { title: 'Writing a story, submitting it for review and publishing', desc: 'The basic flow: write a story, save it, submit it for review, and the Editor-in-Chief publishes it.', linkLabel: 'Write a story' },
  press: { title: 'Turning a press release into a story (AI draft and legal review)', desc: 'How to create an AI draft from the Press releases inbox and get a legal review before publishing. For press releases received by email, the AI draft also reads the attachments (PDF, Hangul, Word, text).', linkLabel: 'Press releases' },
  'pressmail-gmail': { title: 'Automatically receive Gmail press releases in the Press releases inbox', desc: `How to use a Gmail filter to forward only press-release emails to a dedicated address so they collect automatically in the Press releases inbox. ${ADDON_EN}`, linkLabel: 'Email intake setup' },
  'pressmail-gmail-detail': { title: 'Gmail auto-receive in detail (follow along on screen)', desc: `Set it up step by step on screen: adding the forwarding address, the confirmation link, and creating the filter. ${ADDON_EN}`, linkLabel: 'Email intake setup' },
  'pressmail-other': { title: 'Auto-receive press releases from Naver, Daum or company email', desc: `How to have press releases forwarded automatically from an email account that is not Gmail. ${ADDON_EN}`, linkLabel: 'Email intake setup' },
  guide: { title: 'Before you publish: key points of the story writing guide', desc: 'A look at the rules for headlines, bylines and photo credits that match the Naver News partnership evaluation criteria.', linkLabel: 'Writing guide' },
  photos: { title: 'Adding photos to a story and using saved files', desc: 'How to upload photos, add captions, and reuse them from your saved files.', linkLabel: 'Saved files' },
  approve: { title: 'Editor-in-Chief: approving, rejecting and bulk approval', desc: 'How to review stories submitted for approval and publish or reject them all at once.', linkLabel: 'Stories' },
  home: { title: 'Arranging the home page with Edit Home', desc: 'How to choose the headline, top story and featured story slots yourself.', linkLabel: 'Edit Home' },
  sections: { title: 'Organizing sections (menus)', desc: 'How to create sections, reorder them, and group sub-sections.', linkLabel: 'Sections' },
  settings: { title: 'Settings: logo, colors, tab icon, share image and logo strip', desc: 'How to change the name, slogan, logo and brand color shown on your site, the tab icon and share-preview image, and the footer logo strip and required legal notices.', linkLabel: 'Settings' },
  ads: { title: 'Uploading home page ads and scheduling ads', desc: 'How to upload a banner ad and schedule it for a set period.', linkLabel: 'Ads' },
  ads2: { title: 'New ad features: slot settings, drag to reorder, ad inquiries', desc: 'How to turn off ad slots you do not use, choose how many right-side ads to show, drag banners to change their order and slot, and reply to advertiser inquiries.', linkLabel: 'Ads' },
  billing: { title: 'Checking invoices and registering a card (autopay)', desc: 'Enter your billing info, pay from the Pay button in the invoice email without logging in, and see autopay (10 a.m. on the 1st of each month), invoice review and PDF download in one video.', linkLabel: 'Billing info' },
  newsletter: { title: 'Sending a newsletter', desc: 'How to email a roundup of stories to your subscribers.', linkLabel: 'Newsletter' },
  support: { title: 'Using support requests and the Support Center', desc: 'How to leave a request for a change or a question, and how to check replies and notices.', linkLabel: 'Support request' },
}

// 화면 언어에 맞는 제목·설명·연결 이름 (한국어는 HELP_VIDEOS 그대로)
export function helpVideoText(v: HelpVideo, lang?: 'ko' | 'en') {
  const e = lang === 'en' ? HELP_VIDEOS_EN[v.id] : undefined
  return {
    title: e?.title ?? v.title,
    desc: e?.desc ?? v.desc,
    link: v.link ? { ...v.link, label: e?.linkLabel ?? v.link.label } : undefined,
  }
}

// 주소에서 11자리 영상 번호를 뽑는다 (모르는 모양이면 null)
export function youtubeId(input: string | undefined | null): string | null {
  const s = (input ?? '').trim()
  if (!s) return null
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s
  try {
    const u = new URL(s)
    const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '')
    if (host === 'youtu.be') return /^[A-Za-z0-9_-]{11}$/.test(u.pathname.slice(1, 12)) ? u.pathname.slice(1, 12) : null
    if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      const v = u.searchParams.get('v')
      if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v
      const m = u.pathname.match(/^\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{11})/)
      if (m) return m[1]
    }
  } catch { /* 주소가 아님 */ }
  return null
}

export const GUIDE_BUCKET = 'guide-videos'
export const guideFile = (id: string) => `${id}.mp4`
export const posterOf = (id: string) => `/help-videos/${id}.jpg`

// 화면에 보여 줄 영상: 직접 올린 영상(uploaded 에 id 가 있음)이 있으면 그것, 없으면 유튜브
//   lang 'en' 이면 제목·설명·연결 이름이 영어로 바뀐다 (영상 음성은 한국어)
export const readyVideos = (uploaded: ReadonlySet<string> = new Set(), lang?: 'ko' | 'en') =>
  HELP_VIDEOS.flatMap((v) => {
    const own = uploaded.has(v.id)
    const yt = youtubeId(v.youtube)
    return own || yt ? [{ ...v, ...helpVideoText(v, lang), own, videoId: yt }] : []
  })
