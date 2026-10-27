import { FOREIGN_TOPICS, PRESS_FIELDS, type ForeignTopic, type PressField } from './press-sources'
export type SectionConfig = {
  slug: string
  name: string
  description?: string
  specialty?: boolean
  // 2차 메뉴: 상위 섹션 slug (없으면 1차 메뉴)
  parent?: string
  // 메뉴에서 이 섹션 앞에 구분선 (카테고리 관리에서 정함. 없으면 전문 섹션 시작 자리)
  divider?: boolean
}

// 홈 배치 'bands': 1차 섹션을 차례로 띠처럼 쌓는다 (Israel Today 등). style 로 띠 모양을 고른다
export type HomeBandStyle = 'news' | 'brief' | 'feature' | 'grid' | 'video' | 'shop'
export type HomeBand = { slug: string; style: HomeBandStyle; title?: string; tagline?: string }

import { parseAiBotMode, type AiBotMode } from '@/lib/ai-crawlers'
import { isOpenZone } from '@/lib/zoned-time'
import { parseHomeLayout, type HomeLayout } from '@/lib/home-layouts'
export type LogoMode = 'mark' | 'full' | 'text'
// 로고 크기: 이미지에 여백이 많아 작아 보일 때 키운다
export type LogoSize = 'normal' | 'large' | 'xlarge'

// 홈 오른쪽 '숫자 판' (예: 선교 통계). 숫자는 편집국 홈페이지 설정에서 고친다. 출처를 반드시 함께 적는다
export type StatItem = { label: string; value: string; note?: string; source?: string; url?: string }
export type StatsBoard = { title: string; items: StatItem[]; footnote?: string }

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
  // 오픈 준비 중: 켜져 있으면 방문자에게는 안내 화면만 보인다 (홈페이지 설정의 "오픈 준비 중" 스위치)
  comingSoon?: boolean
  // 예약 오픈: 이 시각(절대 시각, ISO)이 되면 오픈 준비 중 화면이 저절로 풀리고 검색 노출 설정이 적용된다 (openTz 는 입력·표시에 쓴 시간대)
  openAt?: string
  openTz?: string
  // 오픈 준비 중 스위치와 상관없이 홈페이지 설정에 저장된 검색 노출 값 (예약 오픈 시각이 지나면 이 값이 쓰인다)
  openIndexable?: boolean
  // 홈페이지 맨 아래에 오른쪽에서 왼쪽으로 흐르는 로고 띠 (협력·후원·제휴 기관)
  logoStrip?: LogoStrip
  // 광고 자리 설정 (끈 자리, 오른쪽 광고 개수)
  adSlots?: AdSlotSettings
  // 오픈 준비 중인 매체를 미리보기로 열어 보는 중 (방문자에게는 안내 화면이 보인다)
  softPreview?: boolean
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
  logoSize?: LogoSize
  colors: { brand: string; brandDark: string; gold: string; goldInk: string }
  sections: SectionConfig[]
  // 보도자료함 "추천" 탭: 제목·요약에 이 단어가 있으면 이 매체와 관련 있는 보도자료로 본다
  pressKeywords: string[]
  legal: SiteLegal
  // 홈 배치 (lib/home-layouts.ts): standard(한국 1, 기본) / bands(한국 3, 섹션 띠)
  homeLayout?: HomeLayout
  bands?: HomeBand[]
  // 띠를 따로 정하지 않아 섹션 순서대로 자동 구성했는지 (true면 한국 스타일 3의 전용 첫 화면, 직접 정한 띠가 있으면 예전 모양 그대로)
  autoBands?: boolean
  // 매체를 연 날 (정책 페이지 시행일이 열기 전 날짜로 나오지 않게)
  createdAt?: string
  // 소개 페이지 샘플 매체: ?layout= 으로 홈 배치를 바꿔 보는 바를 보여 준다 (public-data currentSite 가 주소를 보고 정한다)
  layoutDemo?: boolean
  // SHOP 띠·메뉴에서 연결할 쇼핑몰 주소 (없으면 '준비 중')
  shopUrl?: string
  // 보도자료함에 해외 언론(영문) 자료도 보여줄지 (묶음: 이스라엘 언론, 해외 교육·유학 언론)
  pressForeign?: boolean
  pressForeignTopics?: ForeignTopic[]
  // 보도자료함 추천 탭에 넣을 분야 (의료·복지 / 해운·물류·무역 / 교육)
  pressFields: PressField[]
  // 카카오톡·페이스북 등에 링크를 올릴 때 나오는 대표 이미지 (1200×630 PNG/JPG)
  ogImage?: string
  // 브라우저 탭 아이콘 (편집장이 올린 정사각형 이미지. 없으면 로고)
  iconUrl?: string
  // IM 뉴스룸 체험용 신문 (trial.sql) — 홈페이지 맨 위에 체험판 안내 띠
  trial?: boolean
  // 요금제 (DB 매체만). 베이직도 구독 칸은 보이지만 뉴스레터 발송은 스탠다드부터
  plan?: string | null
  // 홈페이지 언어: ko(기본) / en(영문 매체 — 메뉴·날짜·안내 문구가 영어, lib/site-text.tsx)
  lang?: SiteLang
  // 영문 홈페이지의 날짜·시각 시간대 (IANA 이름, 없으면 미국 동부)
  timeZone?: string
  // 기사 댓글 (독자 로그인 + 승인 후 공개, comments.sql). 기본 꺼짐
  commentsOn?: boolean
  statsBoard?: StatsBoard
  // AI 활용 표시: 켜면 AI 초안 기사 본문 끝에 문구를 붙인다 (lib/ai-notice.ts)
  aiNotice?: { on: boolean; text?: string }
  // AI 크롤러: allow(기본, 안 막음) / answer(학습용 수집만 막음) / block(AI 봇 모두) — robots.txt (lib/ai-crawlers.ts)
  aiBots?: AiBotMode
}

export type SiteLang = 'ko' | 'en'

// public/sites/<폴더>/og.png 가 있는 매체: 로고가 이 폴더에 있으면 대표 이미지도 자동으로 쓴다
const OG_DIRS = ['thecaretimes', 'shippingtimes', 'israeltoday']
export function defaultOgImage(logo?: string) {
  const dir = logo?.match(/^\/sites\/([a-z0-9-]+)\//)?.[1]
  return dir && OG_DIRS.includes(dir) ? `/sites/${dir}/og.png` : undefined
}

// 브라우저 탭 아이콘: 매체 로고를 정사각형으로 맞춘 PNG (app/site-favicon.png, 구글은 정사각형만 쓴다)
//   로고가 없으면 매체 이름 첫 글자 아이콘 (app/site-icon.svg)
//   편집장이 탭 아이콘을 따로 올렸으면 그 이미지를 쓴다 (주소가 바뀌면 브라우저가 새 아이콘을 받도록 ?v= 를 붙인다)
export const siteIcon = (site: SiteConfig) =>
  site.iconUrl ? `/site-favicon.png?v=${[...site.iconUrl].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36)}`
  // 이름까지 들어 있는 가로로 긴 로고(로고 이미지만 모드)는 정사각형 안에서 너무 작아 흰 네모로 보이므로, 아이콘을 올리기 전에는 매체 이름 첫 글자 아이콘을 쓴다
  : site.logoMark && site.logoMode !== 'full' ? '/site-favicon.png' : '/site-icon.svg'

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
    pressFields: ['medical'],
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

// 메뉴 구분선: 카테고리 관리에서 정했으면 그 자리, 아니면 전문 섹션이 시작되는 자리 (category-dividers.sql)
export function dividerBefore(tops: SectionConfig[], i: number) {
  if (tops.some((t) => t.divider !== undefined)) return !!tops[i].divider
  return !!tops[i].specialty && !tops[i - 1]?.specialty
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
  logoSize?: LogoSize
  colors?: { brand?: string; accent?: string }
  indexable?: boolean
  // 오픈 준비 중 (신규 매체는 켜진 채로 만든다. 꺼야 방문자에게 홈페이지가 열린다. 없으면 열린 매체)
  comingSoon?: boolean
  openAt?: string
  openTz?: string
  logoStrip?: LogoStrip
  adSlots?: AdSlotSettings
  pressKeywords?: string
  legal?: Partial<SiteLegal>
  homeLayout?: HomeLayout
  bands?: HomeBand[]
  shopUrl?: string
  pressForeign?: boolean
  // 받을 해외 언론 묶음 (없고 pressForeign 이 켜져 있으면 예전처럼 이스라엘 언론)
  pressForeignTopics?: ForeignTopic[]
  // 보도자료 추천 분야 (없으면 추천 키워드로 짐작)
  pressFields?: PressField[]
  ogImage?: string
  iconUrl?: string
  trial?: boolean
  lang?: SiteLang
  // 영문 홈페이지의 날짜·시각 시간대 (IANA 이름, 없으면 미국 동부)
  timeZone?: string
  commentsOn?: boolean
  // 새 댓글 처리: review(승인 후 공개, 기본) / open(먼저 공개하고 나중에 검토. 자동 검사에 걸린 것은 승인 대기)
  commentsMode?: 'review' | 'open'
  // 편집국(관리 화면) 기본 언어: 개인이 내 정보에서 고르지 않았을 때 쓴다 (없으면 한국어)
  cmsLang?: 'ko' | 'en'
  statsBoard?: StatsBoard
  // AI 활용 표시: 켜면 AI 초안 기사 본문 끝에 문구를 붙인다 (lib/ai-notice.ts)
  aiNotice?: { on: boolean; text?: string }
  aiBots?: AiBotMode
}

export type OutletRow = { id: string; name: string; domain: string | null; site?: OutletSiteSettings | null; created_at?: string | null }
export type CategoryRow = { slug: string; name: string; sort_order?: number | null; specialty?: boolean | null; description?: string | null; parent_slug?: string | null; divider_before?: boolean | null }

const HEX = /^#[0-9a-f]{6}$/i
export const DEFAULT_COLORS = { brand: '#1F3A5F', accent: '#C9A227' }

// 대표색에서 진한 색, 보조색에서 글자용 진한 색을 자동으로 만든다
export function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16)
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * (1 - amount))))
  const r = f(n >> 16), g = f((n >> 8) & 255), b = f(n & 255)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

// 받을 해외 언론 묶음 (예전 설정: '해외 언론 자료 받기'만 켠 매체는 이스라엘 언론)
export function foreignTopics(s: Pick<OutletSiteSettings, 'pressForeign' | 'pressForeignTopics'>): ForeignTopic[] {
  if (Array.isArray(s.pressForeignTopics)) return FOREIGN_TOPICS.map((t) => t.key).filter((k) => s.pressForeignTopics!.includes(k))
  return s.pressForeign ? ['israel'] : []
}

// 보도자료 추천 분야: 매체 설정에서 고른 것, 아직 안 골랐으면 추천 키워드에 분야 단어가 있는지로 짐작한다
export function pressFields(s: Pick<OutletSiteSettings, 'pressFields'>, keywords: string[]): PressField[] {
  if (Array.isArray(s.pressFields)) return PRESS_FIELDS.map((f) => f.key).filter((k) => s.pressFields!.includes(k))
  // 분야 단어가 2개 이상 들어 있어야 그 분야로 본다 (교육 매체 키워드의 '돌봄' 하나로 의료·복지가 되지 않게)
  return PRESS_FIELDS.filter((f) => f.words.filter((w) => keywords.some((k) => k.includes(w))).length >= 2).map((f) => f.key)
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
          divider: typeof c.divider_before === 'boolean' ? c.divider_before : undefined,
        }
      })
    : code?.sections ?? []
  const keywords = s.pressKeywords !== undefined
    ? s.pressKeywords.split(/[,\n]/).map((k) => k.trim()).filter(Boolean)
    : code?.pressKeywords ?? []

  return {
    key: o.id,
    outletId: o.id,
    plan: (o as { plan?: string | null }).plan ?? null,
    preview,
    domains: o.domain ? [o.domain, `www.${o.domain}`] : [],
    createdAt: o.created_at ?? undefined,
    comingSoon: s.comingSoon === true,
    openAt: s.openAt,
    openTz: s.openTz,
    openIndexable: s.indexable ?? code?.indexable ?? false,
    logoStrip: cleanLogoStrip(s.logoStrip),
    adSlots: cleanAdSlots(s.adSlots),
    // 오픈 준비 중에는 검색 노출을 켜 두었어도 수집하지 않는다
    indexable: s.comingSoon === true ? false : (s.indexable ?? code?.indexable ?? false),
    name: o.name,
    nameEn: s.nameEn ?? code?.nameEn ?? '',
    slogan: s.slogan ?? code?.slogan ?? '',
    sloganEn: s.sloganEn ?? code?.sloganEn ?? '',
    description: s.description ?? code?.description ?? (s.lang === 'en' ? `${o.name} — news and analysis` : `${o.name} 인터넷신문`),
    specialtyTitle: s.specialtyTitle || code?.specialtyTitle || (s.lang === 'en' ? 'In Focus' : '전문뉴스'),
    indexWidget: !!s.indexWidget,
    verification: { naver: s.naverVerification || undefined, google: s.googleVerification || undefined },
    logoMark: s.logoUrl ?? code?.logoMark ?? '',
    logoMode: s.logoMode ?? (s.logoUrl || code?.logoMark ? 'mark' : 'text'),
    logoSize: s.logoSize === 'large' || s.logoSize === 'xlarge' ? s.logoSize : 'normal',
    colors: { brand, brandDark: shade(brand, 0.3), gold: accent, goldInk: shade(accent, 0.35) },
    sections,
    pressKeywords: keywords,
    legal: { ...EMPTY_LEGAL, ...(code?.legal ?? {}), ...(s.legal ?? {}) },
    homeLayout: parseHomeLayout(s.homeLayout),
    // 섹션 띠 배치인데 띠를 따로 정하지 않았으면 섹션 순서대로 자동으로 만든다
    bands: Array.isArray(s.bands) && s.bands.length
      ? s.bands.filter((b) => b && typeof b.slug === 'string')
      : parseHomeLayout(s.homeLayout) === 'bands' ? defaultBands(sections) : undefined,
    autoBands: !(Array.isArray(s.bands) && s.bands.length) && parseHomeLayout(s.homeLayout) === 'bands',
    shopUrl: typeof s.shopUrl === 'string' && /^https?:\/\//.test(s.shopUrl) ? s.shopUrl : undefined,
    ...(() => {
      const topics = foreignTopics(s)
      return { pressForeign: topics.length > 0, pressForeignTopics: topics }
    })(),
    pressFields: pressFields(s, keywords),
    ogImage: (typeof s.ogImage === 'string' && s.ogImage) || defaultOgImage(s.logoUrl ?? code?.logoMark),
    iconUrl: (typeof s.iconUrl === 'string' && s.iconUrl) || undefined,
    trial: s.trial === true,
    lang: s.lang === 'en' ? 'en' : 'ko',
    timeZone: isOpenZone(s.timeZone) ? s.timeZone : undefined,
    commentsOn: s.commentsOn === true,
    statsBoard: cleanStats(s.statsBoard),
    aiBots: parseAiBotMode(s.aiBots),
  }
}

// 섹션 띠 자동 구성: 첫 띠는 속보+많이 본 뉴스, 이어서 큰 기사형·사진 4칸형을 번갈아 (최대 8개)
export function defaultBands(sections: SectionConfig[]): HomeBand[] {
  const slugs = new Set(sections.map((s) => s.slug))
  return sections
    .filter((s) => !s.parent || !slugs.has(s.parent))
    .slice(0, 8)
    .map((s, i) => ({ slug: s.slug, style: i === 0 ? 'brief' : i % 2 === 1 ? 'news' : 'grid' }))
}

// 미리보기용: 저장된 설정과 상관없이 다른 홈 배치로 바꿔 본다 (아직 안 만든 배치·모르는 값은 그대로)
export function withLayout(site: SiteConfig, key: string | null | undefined): SiteConfig {
  const l = parseHomeLayout(key)
  if (!key || l !== key) return site
  const auto = l === 'bands' && (!site.bands?.length || !!site.autoBands)
  return { ...site, homeLayout: l, bands: auto ? defaultBands(site.sections) : site.bands, autoBands: auto }
}

// 숫자 판: 이름·숫자가 있는 줄만, 최대 8줄
export function cleanStats(b: StatsBoard | undefined | null): StatsBoard | undefined {
  if (!b || typeof b !== 'object' || !Array.isArray(b.items)) return undefined
  const str = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')
  const items = b.items
    .map((x) => ({ label: str(x?.label, 40), value: str(x?.value, 30), note: str(x?.note, 80) || undefined, source: str(x?.source, 80) || undefined, url: /^https?:\/\/\S+$/.test(str(x?.url, 300)) ? str(x?.url, 300) : undefined }))
    .filter((x) => x.label && x.value)
    .slice(0, 8)
  return items.length ? { title: str(b.title, 30) || '숫자로 보는 현황', items, footnote: str(b.footnote, 200) || undefined } : undefined
}

// 예약 오픈 시각이 지났는가 (지났으면 오픈 준비 중 스위치가 켜져 있어도 열린 매체로 본다)
export const openTimePassed = (s: { openAt?: string | null }, now = Date.now()) => !!s.openAt && Number.isFinite(Date.parse(s.openAt)) && now >= Date.parse(s.openAt)
// 지금 "오픈 준비 중"인가: 스위치가 켜져 있고 예약 시각이 아직 안 왔을 때
export const isPrepNow = (s: { comingSoon?: boolean | null; openAt?: string | null }, now = Date.now()) => s.comingSoon === true && !openTimePassed(s, now)
// 요청이 올 때마다 적용: 예약 시각이 지난 매체는 안내 화면을 풀고, 저장해 둔 검색 노출 설정을 켠다 (매체 설정 캐시 5분과 상관없이 정확한 시각에 열린다)
export function applyOpenSchedule<T extends { comingSoon?: boolean; openAt?: string; openIndexable?: boolean; indexable?: boolean; softPreview?: boolean }>(site: T, now = Date.now()): T {
  if (!site.comingSoon || site.softPreview || !openTimePassed(site, now)) return site
  return { ...site, comingSoon: false, indexable: site.openIndexable ?? false }
}

import { cleanAdSlots, type AdSlotSettings } from './ad-slot-settings'

// 홈페이지 맨 아래 로고 띠 (협력·후원·제휴 기관 로고가 오른쪽에서 왼쪽으로 흐른다)
export type LogoStrip = { title?: string; speed?: 'slow' | 'normal' | 'fast'; items: { name: string; img: string; url?: string }[] }
const STRIP_IMG_OK = (u: string) => u.startsWith('/sites/') || (!!process.env.NEXT_PUBLIC_SUPABASE_URL && u.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`))
// 저장·표시 전에 걸러낸다: 로고 이미지는 이 서비스에 올린 것만, 링크는 http(s)만, 최대 40개
export function cleanLogoStrip(v: unknown): LogoStrip | undefined {
  const o = (v ?? {}) as Partial<LogoStrip>
  const items = (Array.isArray(o.items) ? o.items : [])
    .map((x) => ({
      name: String(x?.name ?? '').trim().slice(0, 40),
      img: String(x?.img ?? '').trim().slice(0, 500),
      url: /^https?:\/\/\S+$/.test(String(x?.url ?? '').trim()) ? String(x.url).trim().slice(0, 300) : undefined,
    }))
    .filter((x) => x.img && STRIP_IMG_OK(x.img))
    .slice(0, 40)
  if (!items.length) return undefined
  return { title: String(o.title ?? '').trim().slice(0, 30) || undefined, speed: o.speed === 'slow' || o.speed === 'fast' ? o.speed : undefined, items }
}
