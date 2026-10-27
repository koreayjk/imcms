// 고객사 개통 체크리스트 (운영팀용). 매체마다 끝낸 항목을 launch_checklists 표에 저장한다 (launch-checklist.sql)
//   순서가 곧 작업 순서다. 검색 등록은 도메인 연결과 "검색 노출" 켜기가 끝난 뒤에 한다
export type LaunchItem = { key: string; title: string; detail?: string; link?: { label: string; href: string } }
export type LaunchGroup = { title: string; items: LaunchItem[] }

export const LAUNCH_GROUPS: LaunchGroup[] = [
  {
    title: '1. 개통 준비',
    items: [
      { key: 'invite', title: '발행인이 초대 메일로 가입하고 로그인했다', detail: '안 되면 회원 메뉴에서 다시 초대' },
      { key: 'domain', title: '매체 도메인 연결 (DNS) 완료', detail: '홈페이지 설정 → 도메인. 오픈 준비 중이면 주소창에는 안내 화면이 보이고, 실제 홈페이지는 미리보기 링크로 확인' },
      { key: 'brand', title: '로고·색·법정 표기 입력', detail: '제호, 발행인·편집인, 인터넷신문 등록번호·등록일, 청소년보호책임자, 주소·연락처' },
      { key: 'sections', title: '섹션 정리', detail: '기본 섹션을 매체에 맞게 고치고 순서 정하기' },
      { key: 'fresh_start', title: '새로 시작하는 매체 (옮길 기사 없음)', detail: '체크하면 고객의 개통 현황에 “기존 기사 옮기기” 대신 “시작용 기사 준비” 단계가 보인다. 진행 항목이 아니라 표시 선택이다' },
      { key: 'import', title: '기존 기사·사진 옮기기 + 옛 기사 주소 연결 확인 (새로 시작하는 매체는 시작용 기사 준비·승인 완료)', detail: '옛 주소(…idxno=123) 하나를 열어 새 기사로 가는지 확인. 새로 시작하는 매체는 시작용 기사를 승인 대기로 넣고 발행인이 승인한 뒤 체크' },
      { key: 'training', title: '사용법 안내 완료', detail: '고객센터 이용안내·기사 작성 가이드 전달 + (원하는 고객은) 통화·화면 공유 1:1 안내 30분. 기사 쓰기·승인·홈편집·광고' },
    ],
  },
  {
    title: '2. 검색 등록 (운영 계정으로)',
    items: [
      { key: 'open_switch', title: '첫 이용료 청구서 납부를 확인하고 오픈 준비 중 스위치를 껐다', detail: '오픈 전에 청구서 → 자동 청구 설정에서 첫 청구 월(오픈일이 달 중간이면 다음 달)·베타 반값을 확인하고, 그 달 청구서를 발행해 납부 기한을 오픈일 전으로 둔다. 납부가 확인되면 홈페이지 설정 → 오픈 준비 중 끄기 (이날이 개통일)' },
      { key: 'indexable', title: '홈페이지 설정 → 검색 노출 → “구글·네이버 검색에 노출하기” 켜기', detail: '테스트 기사를 지운 뒤, 정식 오픈하는 날 켠다. 꺼져 있으면 아래 등록이 실패한다' },
      { key: 'naver_add', title: '네이버 서치어드바이저에 매체 주소 등록 + HTML 태그 받기', detail: '웹마스터 도구 → 사이트 등록 → https:// 부터 전체 주소', link: { label: '서치어드바이저', href: 'https://searchadvisor.naver.com/console/board' } },
      { key: 'google_add', title: '구글 서치콘솔에 매체 주소 등록 (URL 접두어) + HTML 태그 받기', detail: '속성 추가 → 웹사이트 추가 → URL 접두어', link: { label: '서치콘솔', href: 'https://search.google.com/search-console' } },
      { key: 'codes', title: '두 태그를 홈페이지 설정 → 검색 노출 칸에 붙여 넣고 저장', detail: '배포는 필요 없다. 매체 주소에서 페이지 소스(Ctrl+U)에 naver-site-verification·google-site-verification 이 보이면 성공' },
      { key: 'verify', title: '네이버·구글에서 소유 확인 누르기' },
      { key: 'kakao_domain', title: '(요청한 매체만) 카카오 개발자 앱(IM 뉴스룸)에 매체 도메인 등록', detail: 'developers.kakao.com → 앱 → 플랫폼 키 → JavaScript 키 → JavaScript SDK 도메인 + 제품 링크 관리의 웹 도메인에 매체 주소(www 포함)를 넣는다. 그다음 Vercel 환경변수 NEXT_PUBLIC_KAKAO_DOMAINS 에도 매체 주소를 쉼표로 더하고 재배포한다(등록하지 않은 주소는 카카오톡 버튼이 링크 복사·폰 공유창으로 동작). 안 하면 카카오톡 공유가 4019 오류' },
      { key: 'naver_sitemap', title: '네이버: 사이트맵·RSS 제출', detail: '요청 → 사이트맵 제출: 매체주소/sitemap.xml · 요청 → RSS 제출: 매체주소/rss.xml' },
      { key: 'google_sitemap', title: '구글: 사이트맵 제출', detail: 'Sitemaps → sitemap.xml 과 news-sitemap.xml 두 개' },
      { key: 'google_owner', title: '구글 서치콘솔에 대표 구글 계정을 소유자로 추가', detail: '설정 → 사용자 및 권한 → 사용자 추가 → 권한: 소유자. 해지해도 대표가 그대로 가져간다' },
    ],
  },
  {
    title: '3. 안내 전달',
    items: [
      { key: 'naver_news', title: '네이버 “뉴스” 검색제휴는 언론사가 직접 신청한다고 안내', detail: '서치어드바이저는 웹문서 검색까지. 뉴스 탭 노출은 네이버·카카오 뉴스제휴 심사(연 2회 안팎) 통과가 필요' },
      { key: 'check_week', title: '1주 뒤 서치콘솔·서치어드바이저에서 색인 상태 확인', detail: '사이트맵 “성공”, 색인된 페이지 수가 느는지' },
    ],
  },
]

// 영어판: key 로 짝을 맞춘다. 화면에서는 launchGroups(lang) 으로 고른다 (한국어는 LAUNCH_GROUPS 그대로)
const LAUNCH_GROUP_TITLE_EN = ['1. Launch preparation', '2. Search registration (with the operations account)', '3. Customer guidance']
const LAUNCH_ITEM_EN: Record<string, { title: string; detail?: string; linkLabel?: string }> = {
  invite: { title: 'The publisher signed up and logged in from the invitation email', detail: 'If that fails, re-invite from the Members menu' },
  domain: { title: 'Outlet domain connected (DNS) and complete', detail: 'Website settings → Domain. While "Opening soon" is on, the address bar shows the notice page; check the real website with the preview link' },
  brand: { title: 'Logo, colors and legal notices entered', detail: 'Masthead title, publisher and editor names, online newspaper registration number and date, youth protection officer, address and contact details' },
  sections: { title: 'Sections organized', detail: 'Adapt the default sections to the outlet and set their order' },
  fresh_start: { title: 'New outlet starting from scratch (no stories to migrate)', detail: 'When checked, the customer\'s launch status shows the "Starter stories prepared" step instead of "Migrate existing stories". This is a display choice, not a progress item' },
  import: { title: 'Existing stories and photos migrated, and old story URLs confirmed to redirect (for a new outlet: starter stories prepared and approved)', detail: 'Open one old URL (…idxno=123) and confirm it goes to the new story. For a new outlet, put the starter stories in Pending approval and check this once the publisher has approved them' },
  training: { title: 'Usage walkthrough done', detail: 'Hand over the Help Center guides and story writing guide, plus (for customers who want it) a 30-minute one-on-one by phone or screen share. Writing and approving stories, home page editing, ads' },
  open_switch: { title: 'Confirmed payment of the first service fee invoice and turned off the "Opening soon" switch', detail: 'Before launch, check the first billing month (the next month if launch falls mid-month) and the beta half-price under Invoices → Automatic billing, issue that month\'s invoice and set the due date before launch day. Once payment is confirmed, turn off Website settings → Opening soon (this day is the launch date)' },
  indexable: { title: 'Website settings → Search visibility → turn on "Show in Google and Naver search"', detail: 'Turn it on on the official launch day, after deleting the test stories. If it is off, the registrations below fail' },
  naver_add: { title: 'Register the outlet address in Naver Search Advisor and get the HTML tag', detail: 'Webmaster Tools → Register site → full address starting with https://', linkLabel: 'Search Advisor' },
  google_add: { title: 'Register the outlet address in Google Search Console (URL prefix) and get the HTML tag', detail: 'Add property → Add website → URL prefix', linkLabel: 'Search Console' },
  codes: { title: 'Paste both tags into Website settings → Search visibility and save', detail: 'No deployment is needed. Success if naver-site-verification and google-site-verification show up in the page source (Ctrl+U) at the outlet address' },
  verify: { title: 'Click verify ownership in Naver and Google' },
  kakao_domain: { title: '(Only for outlets that requested it) Register the outlet domain in the Kakao developer app (IM Newsroom)', detail: 'developers.kakao.com → App → Platform keys → JavaScript key → add the outlet address (including www) to the JavaScript SDK domains and to the web domains under Product link management. Then also add the outlet address, comma-separated, to the Vercel environment variable NEXT_PUBLIC_KAKAO_DOMAINS and redeploy (unregistered addresses make the KakaoTalk button fall back to copying the link or the phone share sheet). If skipped, KakaoTalk sharing fails with error 4019' },
  naver_sitemap: { title: 'Naver: submit the sitemap and RSS', detail: 'Requests → Submit sitemap: outlet-address/sitemap.xml · Requests → Submit RSS: outlet-address/rss.xml' },
  google_sitemap: { title: 'Google: submit the sitemap', detail: 'Sitemaps → both sitemap.xml and news-sitemap.xml' },
  google_owner: { title: 'Add the publisher\'s Google account as an owner in Google Search Console', detail: 'Settings → Users and permissions → Add user → Permission: Owner. Even if we revoke ours, the publisher keeps full control' },
  naver_news: { title: 'Tell the customer that Naver "News" search partnership is something the outlet applies for itself', detail: 'Search Advisor covers web document search only. Appearing in the News tab requires passing the Naver and Kakao news partnership review (about twice a year)' },
  check_week: { title: 'One week later, check the indexing status in Search Console and Search Advisor', detail: 'Sitemap shows "Success" and the number of indexed pages is growing' },
}
export const LAUNCH_GROUPS_EN: LaunchGroup[] = LAUNCH_GROUPS.map((g, gi) => ({
  title: LAUNCH_GROUP_TITLE_EN[gi] ?? g.title,
  items: g.items.map((i) => {
    const e = LAUNCH_ITEM_EN[i.key]
    if (!e) return i
    return { ...i, title: e.title, detail: e.detail ?? i.detail, link: i.link && e.linkLabel ? { ...i.link, label: e.linkLabel } : i.link }
  }),
}))
// 화면 언어에 맞는 체크리스트 (한국어는 LAUNCH_GROUPS 그대로)
export const launchGroups = (lang?: 'ko' | 'en'): LaunchGroup[] => (lang === 'en' ? LAUNCH_GROUPS_EN : LAUNCH_GROUPS)

export const LAUNCH_KEYS = LAUNCH_GROUPS.flatMap((g) => g.items.map((i) => i.key))
export type LaunchDone = Record<string, string>
