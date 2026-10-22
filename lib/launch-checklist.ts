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
      { key: 'open_switch', title: '오픈 준비 중 스위치를 끄고 첫 이용료 청구서를 발행했다', detail: '홈페이지 설정 → 오픈 준비 중 끄기 (이날이 개통일). 청구서 → 자동 청구 설정에서 첫 청구 월·베타 반값 확인 후 발행' },
      { key: 'indexable', title: '홈페이지 설정 → 검색 노출 → “구글·네이버 검색에 노출하기” 켜기', detail: '테스트 기사를 지운 뒤, 정식 오픈하는 날 켠다. 꺼져 있으면 아래 등록이 실패한다' },
      { key: 'naver_add', title: '네이버 서치어드바이저에 매체 주소 등록 + HTML 태그 받기', detail: '웹마스터 도구 → 사이트 등록 → https:// 부터 전체 주소', link: { label: '서치어드바이저', href: 'https://searchadvisor.naver.com/console/board' } },
      { key: 'google_add', title: '구글 서치콘솔에 매체 주소 등록 (URL 접두어) + HTML 태그 받기', detail: '속성 추가 → 웹사이트 추가 → URL 접두어', link: { label: '서치콘솔', href: 'https://search.google.com/search-console' } },
      { key: 'codes', title: '두 태그를 홈페이지 설정 → 검색 노출 칸에 붙여 넣고 저장', detail: '배포는 필요 없다. 매체 주소에서 페이지 소스(Ctrl+U)에 naver-site-verification·google-site-verification 이 보이면 성공' },
      { key: 'verify', title: '네이버·구글에서 소유 확인 누르기' },
      { key: 'kakao_domain', title: '카카오 개발자 앱(IM 뉴스룸)에 매체 도메인 등록', detail: 'developers.kakao.com → 앱 → 플랫폼 키 → JavaScript 키 → JavaScript SDK 도메인 + 제품 링크 관리의 웹 도메인에 매체 주소(www 포함)를 넣는다. 그다음 Vercel 환경변수 NEXT_PUBLIC_KAKAO_DOMAINS 에도 매체 주소를 쉼표로 더하고 재배포한다(등록하지 않은 주소는 카카오톡 버튼이 링크 복사·폰 공유창으로 동작). 안 하면 카카오톡 공유가 4019 오류' },
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

export const LAUNCH_KEYS = LAUNCH_GROUPS.flatMap((g) => g.items.map((i) => i.key))
export type LaunchDone = Record<string, string>
