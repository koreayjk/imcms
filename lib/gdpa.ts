// 글로벌디지털언론협회(GDPA) 사이트 설정
//   같은 앱의 /gdpa 아래에 있고, GDPA 도메인으로 들어오면 미들웨어가 /gdpa 로 연결한다 (주소창에는 /gdpa 가 보이지 않는다)

export const GDPA = {
  name: '글로벌디지털언론협회',
  short: 'GDPA',
  nameEn: 'Global Digital Press Association',
  slogan: '디지털 시대, 신뢰받는 저널리즘을 함께 만듭니다',
  description: '글로벌디지털언론협회(GDPA)는 디지털 언론사들이 함께 모여 책임 있는 저널리즘과 회원사 간 협력, 언론인 교육을 이어가는 언론 단체입니다.',
  // 도메인을 사면 여기에 넣는다 (Vercel 프로젝트 Domains 에도 추가)
  domains: ['gdpa-org.vercel.app', 'gdpa.kr', 'www.gdpa.kr', 'gdpa.or.kr', 'www.gdpa.or.kr'],
  // 사무국 연락처 (정해지면 넣는다. 비어 있으면 '준비 중')
  office: { address: '', phone: '', email: '', hours: '평일 10:00~17:00 (점심 12:00~13:00)' },
  // 개인정보 보호책임자 (정해지면 넣는다)
  privacyOfficer: { name: '', position: '사무국장', email: '' },
  founded: '2026',
  policyDate: '2026-10-03',
}

// 영문판 (주소 앞에 /en: imnewsroom.com/gdpa/en, gdpa 도메인/en)
export type GdpaLang = 'ko' | 'en'
export const GDPA_EN = {
  name: 'Global Digital Press Association',
  slogan: 'Building trusted journalism together in the digital age',
  description: 'The Global Digital Press Association (GDPA) brings digital news outlets together to uphold responsible journalism, work together as members and train journalists.',
  hours: 'Weekdays 10:00–17:00 KST (lunch 12:00–13:00)',
}

export type GdpaMenu = { label: string; href: string; children?: { label: string; href: string }[] }

// 메뉴 (주소는 /gdpa 를 뺀 상대 경로. 화면에서 base 를 붙인다)
export const GDPA_MENU: GdpaMenu[] = [
  {
    label: '협회소개', href: '/about',
    children: [
      { label: '인사말', href: '/about' },
      { label: '설립 목적·비전', href: '/about/vision' },
      { label: '연혁', href: '/about/history' },
      { label: '조직도', href: '/about/organization' },
      { label: '오시는 길·문의', href: '/about/contact' },
    ],
  },
  {
    label: '회원사', href: '/members',
    children: [
      { label: '회원사 소개', href: '/members' },
      { label: '입회 안내', href: '/members/join' },
      { label: '회원 혜택', href: '/members/benefits' },
    ],
  },
  { label: '협회 활동', href: '/activity' },
  { label: '회원사 뉴스', href: '/news' },
  {
    label: '알림센터', href: '/notice',
    children: [
      { label: '공지사항', href: '/notice' },
      { label: '자료실', href: '/data' },
      { label: '자주 묻는 질문', href: '/faq' },
    ],
  },
]

export const GDPA_MENU_EN: GdpaMenu[] = [
  {
    label: 'About', href: '/about',
    children: [
      { label: 'Greeting', href: '/about' },
      { label: 'Mission & Vision', href: '/about/vision' },
      { label: 'History', href: '/about/history' },
      { label: 'Organization', href: '/about/organization' },
      { label: 'Contact', href: '/about/contact' },
    ],
  },
  {
    label: 'Members', href: '/members',
    children: [
      { label: 'Member Outlets', href: '/members' },
      { label: 'How to Join', href: '/members/join' },
      { label: 'Member Benefits', href: '/members/benefits' },
    ],
  },
  { label: 'Activities', href: '/activity' },
  { label: 'Member News', href: '/news' },
  {
    label: 'Notices', href: '/notice',
    children: [
      { label: 'Announcements', href: '/notice' },
      { label: 'Resources', href: '/data' },
      { label: 'FAQ', href: '/faq' },
    ],
  },
]

export const gdpaMenu = (lang: GdpaLang = 'ko') => (lang === 'en' ? GDPA_MENU_EN : GDPA_MENU)

// 화면 주소를 언어와 상대 경로로 나눈다: '/gdpa/en/about' → { lang: 'en', rel: '/about' }
export function gdpaRoute(path: string, base: string): { lang: GdpaLang; rel: string } {
  let p = base && path.startsWith(base) ? path.slice(base.length) : path
  if (!p.startsWith('/')) p = `/${p}`
  if (p === '/en' || p.startsWith('/en/')) return { lang: 'en', rel: p.slice(3) || '/' }
  return { lang: 'ko', rel: p }
}

export function isGdpaHost(host: string | null | undefined) {
  const h = (host ?? '').split(':')[0].toLowerCase()
  return GDPA.domains.includes(h) || (!!process.env.GDPA_HOST && h === process.env.GDPA_HOST.toLowerCase())
}

// 화면 링크 앞에 붙일 주소: GDPA 도메인이면 '', 다른 주소(imcms.vercel.app/gdpa 등)면 '/gdpa'
export function gdpaBaseFor(host: string | null | undefined) {
  return isGdpaHost(host) ? '' : '/gdpa'
}

export const BOARD_LABEL = { notice: '공지사항', activity: '협회 활동', data: '자료실' } as const
export const BOARD_LABEL_EN = { notice: 'Announcements', activity: 'Activities', data: 'Resources' } as const
export type GdpaBoard = keyof typeof BOARD_LABEL
export const boardLabel = (board: GdpaBoard, lang: GdpaLang = 'ko') => (lang === 'en' ? BOARD_LABEL_EN : BOARD_LABEL)[board]
