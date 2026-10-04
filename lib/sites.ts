export type SectionConfig = {
  slug: string
  name: string
  description?: string
  specialty?: boolean
  // 2차 메뉴: 상위 섹션 slug (없으면 1차 메뉴)
  parent?: string
}

// 홈 배치 'bands': 1차 섹션을 차례로 띠처럼 쌓는다 (Israel Today 등). style 로 띠 모양을 고른다
export type HomeBandStyle = 'news' | 'brief' | 'feature' | 'grid' | 'video' | 'shop'
export type HomeBand = { slug: string; style: HomeBandStyle; title?: string; tagline?: string }

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
  // 검색 포털 소유 확인 코드 (네이버 서치어드바이저·구글 서치콘솔)
  verification?: { naver?: string; google?: string }
  logoMark: string
  // mark: 심볼 + 매체 이름 글자 / full: 로고 이미지만 / text: 매체 이름 글자만
  logoMode?: LogoMode
  colors: { brand: string; brandDark: string; gold: string; goldInk: string }
  sections: SectionConfig[]
  // 보도자료함 "추천" 탭: 제목·요약에 이 단어가 있으면 이 매체와 관련 있는 보도자료로 본다
  pressKeywords: string[]
  legal: SiteLegal
  // 홈 배치: standard(기본) / bands(섹션 띠)
  homeLayout?: 'standard' | 'bands'
  bands?: HomeBand[]
  // SHOP 띠·메뉴에서 연결할 쇼핑몰 주소 (없으면 '준비 중')
  shopUrl?: string
  // 보도자료함에 해외 언론(영문) 자료도 보여줄지
  pressForeign?: boolean
  // 카카오톡·페이스북 등에 링크를 올릴 때 나오는 대표 이미지 (1200×630 PNG/JPG)
  ogImage?: string
  // IM 뉴스룸 체험용 신문 (trial.sql) — 홈페이지 맨 위에 체험판 안내 띠
  trial?: boolean
}

// public/sites/<폴더>/og.png 가 있는 매체: 로고가 이 폴더에 있으면 대표 이미지도 자동으로 쓴다
const OG_DIRS = ['thecaretimes', 'shippingtimes', 'israeltoday']
export function defaultOgImage(logo?: string) {
  const dir = logo?.match(/^\/sites\/([a-z0-9-]+)\//)?.[1]
  return dir && OG_DIRS.includes(dir) ? `/sites/${dir}/og.png` : undefined
}

// 브라우저 탭 아이콘: 로고가 없으면 매체 이름 첫 글자 아이콘 (app/site-icon.svg)
export const siteIcon = (site: SiteConfig) => site.logoMark || '/site-icon.svg'

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
    ogImage: '/sites/thecaretimes/og.png',
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

// 1차 메뉴 (상위 섹션이 없거나, 상위 섹션이 사라진 2차 메뉴)
export function topSections(site: SiteConfig) {
  const slugs = new Set(site.sections.map((s) => s.slug))
  return site.sections.filter((s) => !s.parent || !slugs.has(s.parent))
}

export function childSections(site: SiteConfig, slug: string) {
  return site.sections.filter((s) => s.parent === slug)
}

// 섹션 + 그 아래 2차 메뉴 slug (섹션 기사 목록·홈 띠는 하위 메뉴 기사까지 함께 보여준다)
export function sectionFamily(site: SiteConfig, slug: string) {
  return [slug, ...childSections(site, slug).map((s) => s.slug)]
}

// ───────── DB 설정 → 사이트 ─────────

export type OutletSiteSettings = {
  nameEn?: string
  slogan?: string
  sloganEn?: string
  description?: string
  specialtyTitle?: string
  indexWidget?: boolean
  naverVerification?: string
  googleVerification?: string
  logoUrl?: string
  logoMode?: LogoMode
  colors?: { brand?: string; accent?: string }
  indexable?: boolean
  pressKeywords?: string
  legal?: Partial<SiteLegal>
  homeLayout?: 'standard' | 'bands'
  bands?: HomeBand[]
  shopUrl?: string
  pressForeign?: boolean
  ogImage?: string
  trial?: boolean
}

export type OutletRow = { id: string; name: string; domain: string | null; site?: OutletSiteSettings | null }
export type CategoryRow = { slug: string; name: string; sort_order?: number | null; specialty?: boolean | null; description?: string | null; parent_slug?: string | null }

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
          parent: c.parent_slug || undefined,
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
    verification: { naver: s.naverVerification || undefined, google: s.googleVerification || undefined },
    logoMark: s.logoUrl ?? code?.logoMark ?? '',
    logoMode: s.logoMode ?? (s.logoUrl || code?.logoMark ? 'mark' : 'text'),
    colors: { brand, brandDark: shade(brand, 0.3), gold: accent, goldInk: shade(accent, 0.35) },
    sections,
    pressKeywords: keywords,
    legal: { ...EMPTY_LEGAL, ...(code?.legal ?? {}), ...(s.legal ?? {}) },
    homeLayout: s.homeLayout === 'bands' ? 'bands' : 'standard',
    bands: Array.isArray(s.bands) ? s.bands.filter((b) => b && typeof b.slug === 'string') : undefined,
    shopUrl: typeof s.shopUrl === 'string' && /^https?:\/\//.test(s.shopUrl) ? s.shopUrl : undefined,
    pressForeign: !!s.pressForeign,
    ogImage: (typeof s.ogImage === 'string' && s.ogImage) || defaultOgImage(s.logoUrl ?? code?.logoMark),
    trial: s.trial === true,
  }
}
