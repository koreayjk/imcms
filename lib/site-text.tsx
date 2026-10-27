// 매체 홈페이지 고정 문구 (메뉴·날짜·안내). 영문 매체(site.lang = 'en')는 영어로 보여준다
//   기사 본문·섹션 이름은 편집국에서 쓴 그대로 나간다
import type { SiteLang } from './sites'

const ko = {
  htmlLang: 'ko',
  ogLocale: 'ko_KR',
  // 상단·메뉴
  tip: '기사제보',
  tipSubject: '[기사제보]',
  ads: '광고문의',
  adsSubject: '[광고문의]',
  login: '편집국 로그인',
  utilNav: '이용 안내',
  mainNav: '주요 섹션',
  allNews: '전체기사',
  home: '홈',
  search: '검색',
  searchArticles: '기사 검색',
  searchPlaceholder: '검색어를 입력하세요',
  openMenu: '전체 메뉴 열기',
  closeMenu: '메뉴 닫기',
  fullMenu: '전체 메뉴',
  allSections: '전체 섹션',
  realtime: '실시간 뉴스',
  popular: '많이 본 뉴스',
  major: '주요 뉴스',
  majorShort: '주요뉴스',
  latest: '최신 기사',
  pick: '이슈 PICK',
  topStories: '톱 기사',
  more: '더보기 +',
  moreOf: (name: string) => `${name} 더보기 +`,
  moreOfPlain: (name: string) => `${name} 더보기`,
  moreLabel: (title: string) => `${title} 더보기`,
  // 미리보기 띠
  previewBar: (name: string) => <>{name}</>,
  previewText: '미리보기 — 도메인을 연결하기 전 화면입니다.',
  previewEnd: '미리보기 끝내기',
  // 목록
  noArticles: '아직 발행된 기사가 없습니다.',
  noArticlesSub: '편집국에서 기사를 발행하면 이곳에 표시됩니다.',
  total: (n: number) => <>전체 <strong className="font-semibold text-body tabular-nums">{n.toLocaleString()}</strong>건</>,
  prev: '이전',
  next: '다음',
  pages: '페이지',
  breadcrumb: '현재 위치',
  all: '전체',
  subMenu: (name: string) => `${name} 하위 메뉴`,
  // 기사
  reporter: (name: string) => `${name} 기자`,
  published: '입력',
  views: '조회',
  related: '관련기사',
  moreByReporter: '다른기사 보기',
  syndicated: (outlet: string) => <>이 기사는 <strong className="text-body">{outlet}</strong>에서 제공한 기사입니다.</>,
  original: '원문 보기',
  copyright: (name: string) => `저작권자 © ${name} 무단전재 및 재배포 금지`,
  moreInSection: (name?: string | null): string => `${name ?? '관련'} 다른 기사`,
  notFound: '기사를 찾을 수 없습니다',
  share: '공유',
  copied: '링크가 복사되었습니다.',
  // 기자별
  reporterTitle: (name: string): string => (name ? `${name} 기자` : '기자별 기사'),
  reporterCount: (name: string): string => (name ? `${name} 기자가 쓴 기사` : '기사'),
  reporterNone: (name: string): string => (name ? '이 기자 이름으로 발행된 기사가 없습니다.' : '기자 이름이 없습니다.'),
  byReporter: '기자별 기사',
  // 검색
  searchLabel: '검색어',
  searchHint: '기사 제목으로 검색',
  searchResults: (q: string, n: number) => <>‘<strong className="text-body">{q}</strong>’ 검색 결과 <strong className="text-body tabular-nums">{n}</strong>건</>,
  searchNone: '검색 결과가 없습니다. 다른 검색어로 찾아보세요.',
  // 하단
  footerNav: '하단 메뉴',
  legal: { name: '제호', reg: '등록번호', regAt: '등록일', publisher: '발행인', editor: '편집인', youth: '청소년보호책임자', company: '상호', ceo: '대표', biz: '사업자등록번호', address: '주소', phone: '대표전화', email: '이메일' },
  rights: (name: string) => `${name}의 모든 콘텐츠(기사·사진·영상)는 저작권법의 보호를 받으며, 무단 전재·복사·배포를 금합니다.`,
  // 뉴스레터
  nlTitle: (name: string) => `${name} 뉴스레터`,
  nlSub: '주요 기사를 메일로 받아보세요.',
  nlEmail: '이메일',
  nlPlaceholder: '이메일 주소',
  nlSubmit: '구독하기',
  nlSubmitting: '신청 중…',
  nlAgree: '뉴스레터 발송을 위해 이메일 주소를 수집·이용하는 데 동의합니다. 수신거부할 때까지 보관하며, 메일마다 있는 수신거부 링크로 언제든 끊을 수 있습니다. 동의하지 않으면 구독할 수 없습니다.',
  nlSent: (name: string) => `확인 메일을 보냈습니다. 메일의 “구독 확인”을 누르면 ${name} 뉴스레터를 받아보실 수 있습니다.`,
  // 광고
  ad: '광고',
  adLabel: (name: string) => `광고: ${name}`,
  hideToday: '오늘 하루 보지 않기',
  close: '닫기',
  // 정책
  policyNav: '정책',
  effective: '시행일',
}

export type SiteText = typeof ko

const AP_MONTH = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.']

const en: SiteText = {
  htmlLang: 'en',
  ogLocale: 'en_US',
  tip: 'Send a Tip',
  tipSubject: '[News tip]',
  ads: 'Advertise',
  adsSubject: '[Advertising]',
  login: 'Newsroom Login',
  utilNav: 'Utility',
  mainNav: 'Sections',
  allNews: 'Latest',
  home: 'Home',
  search: 'Search',
  searchArticles: 'Search articles',
  searchPlaceholder: 'Search',
  openMenu: 'Open menu',
  closeMenu: 'Close menu',
  fullMenu: 'Menu',
  allSections: 'All sections',
  realtime: 'Latest News',
  popular: 'Most Read',
  major: 'Top Stories',
  majorShort: 'Top Stories',
  latest: 'Latest',
  pick: "Editors' Picks",
  topStories: 'Top stories',
  more: 'More',
  moreOf: (name: string) => `More in ${name} →`,
  moreOfPlain: (name: string) => `More in ${name}`,
  moreLabel: (title: string) => `More ${title}`,
  previewBar: (name: string) => <>{name}</>,
  previewText: 'Preview — this is how the site looks before the domain is connected.',
  previewEnd: 'End preview',
  noArticles: 'No stories have been published yet.',
  noArticlesSub: 'Stories published from the newsroom will appear here.',
  total: (n: number) => <><strong className="font-semibold text-body tabular-nums">{n.toLocaleString('en-US')}</strong> {n === 1 ? 'story' : 'stories'}</>,
  prev: 'Previous',
  next: 'Next',
  pages: 'Pages',
  breadcrumb: 'Breadcrumb',
  all: 'All',
  subMenu: (name: string) => `${name} subsections`,
  reporter: (name: string) => `By ${name}`,
  published: 'Published',
  views: 'Views',
  related: 'Related',
  moreByReporter: 'More from this writer',
  syndicated: (outlet: string) => <>This story was provided by <strong className="text-body">{outlet}</strong>.</>,
  original: 'Read the original',
  copyright: (name: string) => `© ${name}. All rights reserved.`,
  moreInSection: (name?: string | null) => (name ? `More in ${name}` : 'More stories'),
  notFound: 'Story not found',
  share: 'Share',
  copied: 'Link copied.',
  reporterTitle: (name: string) => (name ? name : 'Stories by writer'),
  reporterCount: (name: string) => (name ? `Stories by ${name}` : 'Stories'),
  reporterNone: (name: string) => (name ? 'No stories have been published under this name.' : 'No writer name given.'),
  byReporter: 'Stories by writer',
  searchLabel: 'Search terms',
  searchHint: 'Search headlines',
  searchResults: (q: string, n: number) => <><strong className="text-body tabular-nums">{n}</strong> {n === 1 ? 'result' : 'results'} for “<strong className="text-body">{q}</strong>”</>,
  searchNone: 'No results. Try a different search.',
  footerNav: 'Footer',
  legal: { name: 'Masthead', reg: 'Registration No.', regAt: 'Registered', publisher: 'Publisher', editor: 'Editor', youth: 'Youth Protection Officer', company: 'Company', ceo: 'CEO', biz: 'Business Reg. No.', address: 'Address', phone: 'Phone', email: 'Email' },
  rights: (name: string) => `All content on ${name}, including articles, photos and video, is protected by copyright and may not be reproduced or redistributed without permission.`,
  nlTitle: (name: string) => `${name} Newsletter`,
  nlSub: 'Get the top stories in your inbox.',
  nlEmail: 'Email',
  nlPlaceholder: 'Email address',
  nlSubmit: 'Subscribe',
  nlSubmitting: 'Signing up…',
  nlAgree: 'I agree to the collection and use of my email address to receive the newsletter. It is kept until I unsubscribe, and every email includes an unsubscribe link.',
  nlSent: (name: string) => `Check your inbox. Click “Confirm subscription” in the email to start receiving the ${name} newsletter.`,
  ad: 'Ad',
  adLabel: (name: string) => `Advertisement: ${name}`,
  hideToday: "Don't show again today",
  close: 'Close',
  policyNav: 'Policies',
  effective: 'Effective',
}

export function siteText(site: { lang?: SiteLang } | SiteLang | undefined | null): SiteText {
  const lang = typeof site === 'string' ? site : site?.lang
  return lang === 'en' ? en : ko
}

// ───────── 날짜 (한국어: 한국 시간 2026.10.14 / 영어: 미국 동부 시간, AP 표기 Oct. 14, 2026) ─────────
const ET = 'America/New_York'
// 영문 매체의 시간대 (없으면 미국 동부). 이름표는 AP 식 ET·CT·MT·PT
const ZONE_ABBR: Record<string, string> = { 'America/New_York': 'ET', 'America/Chicago': 'CT', 'America/Denver': 'MT', 'America/Los_Angeles': 'PT', 'Pacific/Honolulu': 'HT', UTC: 'UTC' }
const zoneAbbr = (tz: string) => ZONE_ABBR[tz] ?? tz.split('/').pop()?.replace(/_/g, ' ') ?? tz
function etParts(iso: string, tz: string = ET) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true, weekday: 'long' })
      .formatToParts(new Date(iso)).map((x) => [x.type, x.value]),
  )
  return { y: p.year, m: Number(p.month), d: p.day, h: p.hour, mm: p.minute, ap: (p.dayPeriod ?? '').toLowerCase() === 'pm' ? 'p.m.' : 'a.m.', wd: p.weekday }
}
export const enDate = (iso: string, tz?: string) => { const t = etParts(iso, tz); return `${AP_MONTH[t.m - 1]} ${t.d}, ${t.y}` }
export const enTime = (iso: string, tz?: string) => { const t = etParts(iso, tz); return `${t.h}:${t.mm} ${t.ap}` }
export const enDateTime = (iso: string, tz: string = ET) => `${enDate(iso, tz)}, ${enTime(iso, tz)} ${zoneAbbr(tz)}`
export const enShort = (iso: string, tz?: string) => {
  const t = etParts(iso, tz), n = etParts(new Date().toISOString(), tz)
  return t.y === n.y && t.m === n.m && t.d === n.d ? enTime(iso, tz) : `${AP_MONTH[t.m - 1]} ${t.d}`
}
export const enToday = (tz: string = ET) => {
  const now = new Date().toISOString(), t = etParts(now, tz)
  return `${t.wd}, ${new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'long' }).format(new Date(now))} ${t.d}, ${t.y}`
}
