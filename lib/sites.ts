export type SectionConfig = {
  slug: string
  name: string
  description?: string
  specialty?: boolean
}

export type LogoMode = 'mark' | 'full' | 'text'

export type SiteLegal = {
  company: string
  ceo: string
  publisher: string
  editor: string
  youthOfficer: string
  registrationNo: string
  registeredAt: string
  bizNo: string
  postcode: string
  address: string
  phone: string
  email: string
}

export type SiteConfig = {
  key: string
  // DB 매체 ID (DB 설정으로 만든 사이트만)
  outletId?: string
  // 도메인 연결 전 미리보기로 보고 있는지
  preview?: boolean
  domains: string[]
  // 정식 오픈 전(테스트 기사가 있는 동안)에는 false로 두어 검색엔진 수집을 막는다
  indexable: boolean
  name: string
  nameEn: string
  slogan: string
  sloganEn: string
  description: string
  // 첫 화면 전문 섹션 묶음의 제목 (예: 케어 전문뉴스, 국제물류 전문뉴스)
  specialtyTitle: string
  // 해운 운임지수(SCFI·KCCI) 위젯을 홈 오른쪽에 보여줄지
  indexWidget?: boolean
  logoMark: string
  // mark: 심볼 + 매체 이름 글자 / full: 로고 이미지만 / text: 매체 이름 글자만
  logoMode?: LogoMode
  colors: { brand: string; brandDark: string; gold: string; goldInk: string }
  sections: SectionConfig[]
  // 보도자료함 "추천" 탭: 제목·요약에 이 단어가 있으면 이 매체와 관련 있는 보도자료로 본다
  pressKeywords: string[]
  legal: SiteLegal
}

export const SITES: SiteConfig[] = [
  {
    key: 'thecaretimes',
    // 첫 번째가 대표 도메인 (DB outlets.domain과 같아야 기사를 찾는다)
    domains: ['thecaretimes.net', 'www.thecaretimes.net'],
    indexable: false,
    name: '더케어타임즈',
    nameEn: 'THE CARE TIMES',
    slogan: '세상을 더 깊이, 사람을 더 가까이',
    sloganEn: 'NEWS FOR A BETTER TOMORROW',
    description: '보건·복지, 병원·의료, 요양·시니어케어, 돌봄산업 전문 인터넷신문',
    specialtyTitle: '케어 전문뉴스',
    logoMark: '/sites/thecaretimes/logo-mark.png',
    colors: { brand: '#02472F', brandDark: '#01321F', gold: '#D3A82B', goldInk: '#8C6D12' },
    sections: [
      { slug: 'politics', name: '정치' },
      { slug: 'economy', name: '경제' },
      { slug: 'society', name: '사회' },
      { slug: 'culture', name: '문화' },
      { slug: 'health-welfare', name: '보건·복지', description: '보건·복지 분야 전문 소식', specialty: true },
      { slug: 'medical', name: '병원·의료', description: '병원·의료기관 관련 정보', specialty: true },
      { slug: 'senior-care', name: '요양·시니어케어', description: '요양병원·요양시설·시니어케어', specialty: true },
      { slug: 'care-industry', name: '돌봄산업', description: '복지·돌봄산업 관련 소식', specialty: true },
    ],
    pressKeywords: [
      '요양', '돌봄', '간병', '복지', '노인', '어르신', '시니어', '실버', '치매', '장애', '재활',
      '병원', '의료', '의원', '의사', '간호', '환자', '건강', '보건', '질병', '감염', '백신',
      '제약', '의약', '의료기기', '헬스케어', '건강보험', '장기요양', '호스피스', '임종',
    ],
    legal: {
      company: '더케어타임즈',
      ceo: '김경석',
      publisher: '김경석',
      editor: '김경석',
      youthOfficer: '김경석',
      registrationNo: '경기, 아53782',
      registeredAt: '2023.09.04',
      bizNo: '779-14-02872',
      postcode: '16566',
      address: '경기도 수원시 권선구 경수대로352번길 30, B1층 (권선동)',
      phone: '010-2280-9089',
      email: 'thecaretimes@gmail.com',
    },
  },
]

export function resolveSite(host: string | null | undefined): SiteConfig {
  const h = (host ?? '').split(':')[0].toLowerCase()
  return SITES.find((s) => s.domains.includes(h)) ?? SITES[0]
}

export function findSection(site: SiteConfig, slug: string) {
  return site.sections.find((s) => s.slug === slug)
}

// ───────── DB 설정 → 사이트 ─────────

export type OutletSiteSettings = {
  nameEn?: string
  slogan?: string
  sloganEn?: string
  description?: string
  specialtyTitle?: string
  indexWidget?: boolean
  logoUrl?: string
  logoMode?: LogoMode
  colors?: { brand?: string; accent?: string }
  indexable?: boolean
  pressKeywords?: string
  legal?: Partial<SiteLegal>
}

export type OutletRow = { id: string; name: string; domain: string | null; site?: OutletSiteSettings | null }
export type CategoryRow = { slug: string; name: string; sort_order?: number | null; specialty?: boolean | null; description?: string | null }

const HEX = /^#[0-9a-f]{6}$/i
export const DEFAULT_COLORS = { brand: '#1F3A5F', accent: '#C9A227' }

// 대표색에서 진한 색, 보조색에서 글자용 진한 색을 자동으로 만든다
export function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16)
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * (1 - amount))))
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

export const EMPTY_LEGAL: SiteLegal = {
  company: '', ceo: '', publisher: '', editor: '', youthOfficer: '', registrationNo: '', registeredAt: '',
  bizNo: '', postcode: '', address: '', phone: '', email: '',
}

export function buildSite(o: OutletRow, cats: CategoryRow[], preview = false): SiteConfig {
  const s = o.site ?? {}
  // DB 설정이 아직 비어 있으면 코드에 있던 설정(더케어타임즈)을 쓴다
  const code = SITES.find((x) => o.domain && x.domains.includes(o.domain))
  const brand = HEX.test(s.colors?.brand ?? '') ? s.colors!.brand! : code?.colors.brand ?? DEFAULT_COLORS.brand
  const accent = HEX.test(s.colors?.accent ?? '') ? s.colors!.accent! : code?.colors.gold ?? DEFAULT_COLORS.accent
  const sections = cats.length
    ? [...cats].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)).map((c) => {
        // outlet-sites.sql 전에는 전문 섹션 표시가 없으므로 코드 설정에서 빌려온다
        const old = code?.sections.find((x) => x.slug === c.slug)
        return {
          slug: c.slug,
          name: c.name,
          specialty: c.specialty ?? old?.specialty ?? false,
          description: c.description ?? old?.description ?? undefined,
        }
      })
    : code?.sections ?? []
  const keywords = s.pressKeywords !== undefined
    ? s.pressKeywords.split(/[,\n]/).map((k) => k.trim()).filter(Boolean)
    : code?.pressKeywords ?? []

  return {
    key: o.id,
    outletId: o.id,
    preview,
    domains: o.domain ? [o.domain, `www.${o.domain}`] : [],
    indexable: s.indexable ?? code?.indexable ?? false,
    name: o.name,
    nameEn: s.nameEn ?? code?.nameEn ?? '',
    slogan: s.slogan ?? code?.slogan ?? '',
    sloganEn: s.sloganEn ?? code?.sloganEn ?? '',
    description: s.description ?? code?.description ?? `${o.name} 인터넷신문`,
    specialtyTitle: s.specialtyTitle || code?.specialtyTitle || '전문뉴스',
    indexWidget: !!s.indexWidget,
    logoMark: s.logoUrl ?? code?.logoMark ?? '',
    logoMode: s.logoMode ?? (s.logoUrl || code?.logoMark ? 'mark' : 'text'),
    colors: { brand, brandDark: shade(brand, 0.3), gold: accent, goldInk: shade(accent, 0.35) },
    sections,
    pressKeywords: keywords,
    legal: { ...EMPTY_LEGAL, ...(code?.legal ?? {}), ...(s.legal ?? {}) },
  }
}
