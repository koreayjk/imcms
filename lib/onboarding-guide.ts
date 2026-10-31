// 개통 일정 안내: 신청이 들어온 뒤 "며칠 안에 무엇이 세팅되고 최종 무엇이 되는지"를 한 곳에서 정의한다
//   공개 안내 페이지(/imnewsroom/onboarding), 편집국 "개통 진행 현황", 고객 안내 메일이 모두 이 목록을 쓴다
//   days 는 영업일 기준 목표다. 고객 자료·도메인 설정이 늦어지면 같이 늦어지므로 약속이 아닌 "보통"으로 안내한다 (고치려면 여기만)
//   keys 는 운영팀 개통 체크리스트(lib/launch-checklist.ts)의 항목이다: 모두 체크되면 그 단계가 끝난 것으로 보여 준다
export type OnboardingStep = {
  id: string
  days: string
  title: string
  we: string[]
  you: string[]
  result: string
  keys: string[]
  // 이 항목 중 하나라도 끝났으면(이미 그 뒤 단계까지 간 매체) 이 단계도 끝난 것으로 본다. 나중에 끼워 넣은 단계가 예전 매체에 "진행 중"으로 뜨지 않게 한다
  doneIfAny?: string[]
  // 새로 시작하는 매체(옮길 기사가 없는 경우)에 대신 보여 줄 내용. 운영팀이 개통 체크리스트에서 "새로 시작하는 매체"를 체크하면 고객에게는 이쪽이 보인다
  alt?: { days: string; title: string; we: string[]; you: string[]; result: string }
}

// 개통 체크리스트(lib/launch-checklist.ts)의 "새로 시작하는 매체" 항목 키
export const FRESH_KEY = 'fresh_start'

// 고객에게 보여 줄 단계 내용: 새로 시작하는 매체면 alt 로 바꾼다
export function stepView(s: OnboardingStep, fresh: boolean) {
  return fresh && s.alt ? { ...s, ...s.alt } : s
}

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'apply',
    days: '신청 당일 ~ 2일',
    title: '신청 접수와 상담',
    we: ['접수 확인 메일과 견적서를 보내 드립니다.', '담당자가 영업일 기준 이틀 안에 전화나 메일로 연락해 계약 내용과 개통 일정을 정합니다.'],
    you: ['안내받은 연락에 회신해 주세요.', '쓰시는 기사 관리 프로그램이 있으면 알려 주세요 (기사·사진을 옮겨 드립니다).'],
    result: '계약 내용과 개통 일정이 확정됩니다.',
    keys: [],
  },
  {
    id: 'open',
    days: '1~2일',
    title: '편집국·홈페이지 개설과 초대',
    we: ['매체 전용 편집국과 홈페이지를 만들고, 발행인 초대 메일을 보냅니다. 오픈 전까지 도메인에는 “오픈 준비 중” 화면이 보이며, 실제 홈페이지는 미리보기 링크로 보여 드립니다.'],
    you: ['초대 메일의 링크로 가입하고 로그인해 주세요.'],
    result: '발행인 계정으로 편집국에 들어갈 수 있습니다.',
    keys: ['invite'],
  },
  {
    id: 'domain',
    days: '2~3일',
    title: '도메인 연결',
    we: ['연결에 필요한 값(A·CNAME)을 안내하고, 연결이 끝나면 매체 주소로 열리는지 확인합니다.'],
    you: ['도메인을 구입하신 업체에서 DNS 설정을 바꿔 주세요 (약 10분). 아이디·비밀번호는 저희에게 보내지 않으셔도 됩니다.'],
    result: '매체 주소(예: www.○○○.co.kr)로 홈페이지가 열립니다.',
    keys: ['domain'],
  },
  {
    id: 'brand',
    days: '3~5일',
    title: '로고·색·법정 표기·섹션 정리',
    we: ['받은 자료로 로고, 대표 색, 제호, 발행인·편집인, 인터넷신문 등록번호, 청소년보호책임자, 연락처를 넣고 섹션(메뉴)과 홈 모양을 정리합니다.'],
    you: ['로고 파일(배경 투명 PNG), 대표 색, 메뉴 구성, 하단에 넣을 법정 표기 정보를 보내 주세요.'],
    result: '홈페이지가 매체 얼굴로 꾸며지고 법정 표기가 갖춰집니다.',
    keys: ['brand', 'sections'],
  },
  {
    id: 'import',
    days: '3~7일',
    title: '기존 기사·사진 옮기기',
    we: ['쓰시던 프로그램의 기사와 사진을 옮기고, 옛 기사 주소로 들어와도 새 기사로 이어지게 연결합니다.'],
    you: ['기존 기사 자료(내보내기 파일 또는 접속 정보)를 안전한 방법으로 전달해 주세요. 새로 시작하시는 매체는 건너뜁니다.'],
    result: '이전 기사가 새 홈페이지에서 그대로 보이고, 검색으로 들어온 독자도 끊기지 않습니다.',
    keys: ['import'],
    alt: {
      days: '3~7일',
      title: '시작용 기사 준비',
      we: ['새로 시작하시는 매체라 옮길 기사가 없으므로, 오픈 날 첫 화면이 비지 않도록 섹션마다 시작용 기사를 준비합니다.', '정부·공공기관 보도자료를 바탕으로 기사 초안과 사진을 만들어 “승인 대기”로 넣어 둡니다. AI 활용 사실은 기사에 표시합니다. 기자명은 편집장님 성함으로 올려 두며, 기사 수정 화면에서 바꿀 수 있습니다.'],
      you: ['초안을 읽어 보시고 발행할 기사는 승인하고, 고칠 부분은 고치거나 빼 주세요. 발행 책임은 승인하신 매체에 있습니다.', '사설·칼럼·인터뷰 같은 오피니언·취재 기사는 초안(작성 중)만 드리며, 마무리는 매체에서 해 주셔야 합니다.'],
      result: '오픈 날 홈페이지가 비어 있지 않고, 승인하신 시작용 기사로 채워집니다.',
    },
  },
  {
    id: 'design',
    days: '5~8일',
    title: '디자인 점검과 수정',
    we: ['기본으로 꾸며 둔 홈페이지(홈 모양, 색, 로고 위치, 섹션 배치, 광고 자리 등)를 미리보기 링크로 보여 드리고, 바꾸고 싶은 디자인과 새로 넣고 싶은 디자인이 있는지 여쭙니다.', '말씀해 주신 내용을 반영해 수정하고, 수정본을 다시 확인받습니다. 반영하기 어려운 부분은 이유와 대안을 함께 알려 드립니다.'],
    you: ['미리보기 링크로 홈페이지를 둘러보시고, 기본 디자인에서 바꾸고 싶은 곳과 넣고 싶은 디자인(예: 홈 모양, 색, 글자 느낌, 로고 위치, 띠 배너, 섹션 구성)을 개통 현황의 코멘트로 남겨 주세요. 참고하고 싶은 사이트 주소나 이미지를 함께 주셔도 좋습니다.', '수정본을 보시고 마음에 드시면 “확정”이라고 알려 주세요. 바꿀 곳이 없으시면 “그대로 진행”이라고만 남기셔도 됩니다.'],
    result: '원하시는 모습의 홈페이지로 확정되고, 이후 오픈까지 그 디자인으로 진행됩니다.',
    keys: ['design_collect', 'design_apply'],
    doneIfAny: ['training', 'open_switch'],
  },
  {
    id: 'training',
    days: '5~7일',
    title: '사용법 안내',
    we: ['편집국 고객센터의 이용안내와 기사 작성 가이드(기사 쓰기·승인, 보도자료, 홈 편집, 광고 사용법)를 안내해 드리고, 막히는 부분은 업무요청으로 바로 답해 드립니다.', '원하시면 통화나 화면 공유로 30분 안팎 함께 보며 1:1로 안내합니다.'],
    you: ['고객센터 이용안내와 작성 가이드를 한 번 훑어봐 주세요. 특히 기사 작성 가이드는 네이버 뉴스제휴 평가 기준이 담겨 있어 꼭 읽어 주세요.', '1:1 안내를 원하시면 편하신 시간을 알려 주세요. 기자·편집장도 함께하시면 좋습니다.'],
    result: '직접 기사를 쓰고 승인·발행할 수 있습니다.',
    keys: ['training'],
  },
  {
    id: 'launch',
    days: '오픈일',
    title: '정식 오픈과 검색 등록',
    we: ['첫 이용료 청구서를 오픈 전에 발행하고, 납부를 확인한 뒤 정식 오픈일에 “오픈 준비 중” 안내 화면을 내리고 홈페이지를 엽니다. 개통 작업 중에는 비용이 없습니다.', '테스트 기사를 정리하고 검색 노출을 켭니다.', '네이버 서치어드바이저와 구글 서치콘솔에 매체를 등록하고 사이트맵을 제출합니다.', '대표님 구글 계정을 서치콘솔 소유자로 추가합니다.'],
    you: ['오픈 날짜를 정해 주세요.', '서치콘솔 소유자 추가를 위해 대표님 구글 계정 주소를 알려 주세요.'],
    result: '오픈 전에 낸 첫 이용료로 홈페이지가 열리고, 구글·네이버 웹 검색에 매체가 등록되기 시작합니다.',
    keys: ['open_switch', 'indexable', 'naver_add', 'google_add', 'codes', 'verify', 'naver_sitemap', 'google_sitemap', 'google_owner'],
  },
  {
    id: 'after',
    days: '오픈 후 1주',
    title: '오픈 후 점검과 안내',
    we: ['1주 뒤 색인 상태를 확인해 알려 드립니다.', '네이버·카카오 “뉴스” 노출(뉴스제휴 심사)은 언론사가 직접 신청하는 절차라, 준비 방법을 안내해 드립니다.'],
    you: ['뉴스제휴 심사를 원하시면 신청 시기와 서류를 저희와 함께 확인해요.'],
    result: '검색 등록이 정상인지 확인되고, 다음 목표(뉴스제휴)가 정리됩니다.',
    keys: ['naver_news', 'check_week'],
  },
]

// 영어판: id 로 짝을 맞춘다 (keys 는 한국어 목록 것을 그대로 쓴다). 화면에서는 onboardingSteps(lang) 으로 고른다
const ONBOARDING_EN: Record<string, Omit<OnboardingStep, 'id' | 'keys'>> = {
  apply: {
    days: 'Application day to day 2',
    title: 'Application received and consultation',
    we: ['We send a confirmation email and a quote.', 'Within two business days, your account manager contacts you by phone or email to settle the contract terms and launch schedule.'],
    you: ['Please reply to the message you receive.', 'If you use a newsroom/CMS program today, let us know (we will migrate your stories and photos).'],
    result: 'The contract terms and launch schedule are confirmed.',
  },
  open: {
    days: 'Days 1-2',
    title: 'Newsroom and website set up, invitation sent',
    we: ['We create your outlet\'s own newsroom and website and send the publisher an invitation email. Until launch, your domain shows an "Opening soon" page, and we show you the real website through a preview link.'],
    you: ['Sign up and log in using the link in the invitation email.'],
    result: 'You can enter the newsroom with the publisher account.',
  },
  domain: {
    days: 'Days 2-3',
    title: 'Connect your domain',
    we: ['We give you the values needed for the connection (A and CNAME records) and, once connected, confirm that your outlet\'s address opens the website.'],
    you: ['Change the DNS settings at the company where you bought the domain (about 10 minutes). You do not need to send us your ID or password.'],
    result: 'The website opens at your outlet\'s address (e.g. www.example.com).',
  },
  brand: {
    days: 'Days 3-5',
    title: 'Logo, colors, legal notices and sections',
    we: ['Using the materials you send, we enter your logo, brand color, masthead name, publisher and editor names, online newspaper registration number, youth protection officer and contact details, then set up the sections (menu) and the look of the home page.'],
    you: ['Send your logo file (PNG with a transparent background), brand color, menu structure, and the legal notice information to show in the footer.'],
    result: 'The website is styled as your outlet and the legally required notices are in place.',
  },
  import: {
    days: 'Days 3-7',
    title: 'Migrate existing stories and photos',
    we: ['We move the stories and photos from your current program and link old story URLs to the new stories, so old links still work.'],
    you: ['Send your existing story data (an export file or access details) by a secure method. Outlets starting from scratch skip this step.'],
    result: 'Your earlier stories appear on the new website as they were, and readers arriving from search are not cut off.',
    alt: {
      days: 'Days 3-7',
      title: 'Starter stories prepared',
      we: ['Because your outlet is starting fresh and has no stories to migrate, we prepare starter stories for each section so the home page is not empty on launch day.', 'We draft stories and create photos based on press releases from government and public agencies, and put them in "Pending approval". The use of AI is disclosed in each story. The byline is set to your editor-in-chief\'s name, and you can change it on the story edit screen.'],
      you: ['Read the drafts, approve the stories you want to publish, and edit or remove the rest. The outlet that approves a story is responsible for publishing it.', 'For opinion and reported pieces such as editorials, columns and interviews, we provide only drafts (in progress); your outlet needs to finish them.'],
      result: 'On launch day the website is not empty; it is filled with the starter stories you approved.',
    },
  },
  design: {
    days: 'Days 5-8',
    title: 'Design review and changes',
    we: ['We show you the default-styled website (home layout, colors, logo placement, section arrangement, ad slots, etc.) through a preview link and ask whether there is any design you would like to change, or any design you would like to add.', 'We make the changes you ask for and send you the updated version to check. For anything we cannot do, we explain why and offer an alternative.'],
    you: ['Look around the website through the preview link and leave a comment in the launch status about what you would like to change from the default design and any design you would like to add (for example the home layout, colors, typography, logo placement, strip banners, or section structure). You can also share the address of a website or an image you like as a reference.', 'When you like the updated version, tell us it is “confirmed”. If there is nothing to change, just leave a note saying “proceed as is”.'],
    result: 'The website design is confirmed the way you want it, and we continue to launch with that design.',
  },
  training: {
    days: 'Days 5-7',
    title: 'How to use the newsroom',
    we: ['We walk you through the Help Center guides and the story writing guide (writing and approving stories, press releases, home page editing, using ads), and answer anything you get stuck on right away through work requests.', 'If you like, we go through it together one-on-one by phone or screen share for about 30 minutes.'],
    you: ['Take a quick look at the Help Center guides and the writing guide. Please be sure to read the story writing guide, which contains the Naver News partnership evaluation criteria.', 'If you want a one-on-one session, tell us a time that suits you. It helps if your reporters and editor-in-chief join too.'],
    result: 'You can write, approve and publish stories on your own.',
  },
  launch: {
    days: 'Launch day',
    title: 'Official launch and search registration',
    we: ['We issue the first service fee invoice before launch, confirm payment, and on the official launch day take down the "Opening soon" page and open the website. There is no charge while launch work is under way.', 'We clean up the test stories and turn on search visibility.', 'We register your outlet with Naver Search Advisor and Google Search Console and submit the sitemap.', 'We add your Google account as an owner of Search Console.'],
    you: ['Choose your launch date.', 'Tell us your Google account address so we can add you as a Search Console owner.'],
    result: 'The website opens on the first service fee paid before launch, and your outlet starts to be registered in Google and Naver web search.',
  },
  after: {
    days: '1 week after launch',
    title: 'Post-launch check and guidance',
    we: ['One week later, we check the indexing status and report back to you.', 'Appearing in Naver and Kakao "News" (the news partnership review) is a process the news outlet applies for itself, so we guide you on how to prepare.'],
    you: ['If you want to go for the news partnership review, we will check the application timing and documents together.'],
    result: 'Search registration is confirmed to be working, and your next goal (news partnership) is laid out.',
  },
}
export const ONBOARDING_STEPS_EN: OnboardingStep[] = ONBOARDING_STEPS.map((s) => ({ ...s, ...ONBOARDING_EN[s.id] }))
// 화면 언어에 맞는 단계 목록 (한국어는 ONBOARDING_STEPS 그대로)
export const onboardingSteps = (lang?: 'ko' | 'en'): OnboardingStep[] => (lang === 'en' ? ONBOARDING_STEPS_EN : ONBOARDING_STEPS)

export type StepState = 'done' | 'doing' | 'todo'

// 끝낸 항목(done) 으로 단계별 상태를 계산한다: 앞에서부터 모두 끝난 단계는 done, 처음 끝나지 않은 단계는 doing, 나머지는 todo
//   opened=true 는 개설된 매체(접수·상담 단계는 끝난 것으로 본다)
export function stepStates(done: Record<string, unknown> | null | undefined, opened: boolean): StepState[] {
  const d = done ?? {}
  let seenDoing = false
  return ONBOARDING_STEPS.map((s) => {
    const complete = s.keys.length === 0 ? opened : s.keys.every((k) => d[k]) || !!s.doneIfAny?.some((k) => d[k])
    if (complete) return 'done'
    if (!seenDoing) { seenDoing = true; return 'doing' }
    return 'todo'
  })
}

// 고객에게 보내는 공개 안내 주소 (proxy.ts 가 imnewsroom.com/onboarding 을 안내 페이지로 연결한다)
export const ONBOARDING_URL = 'https://imnewsroom.com/onboarding'
