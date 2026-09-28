export type SectionConfig = {
  slug: string
  name: string
  description?: string
  specialty?: boolean
}

export type SiteConfig = {
  key: string
  domains: string[]
  name: string
  nameEn: string
  slogan: string
  sloganEn: string
  description: string
  logoMark: string
  colors: { brand: string; brandDark: string; gold: string; goldInk: string }
  sections: SectionConfig[]
  legal: {
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
}

export const SITES: SiteConfig[] = [
  {
    key: 'thecaretimes',
    domains: ['thecaretimes.com', 'www.thecaretimes.com'],
    name: '더케어타임즈',
    nameEn: 'THE CARE TIMES',
    slogan: '세상을 더 깊이, 사람을 더 가까이',
    sloganEn: 'NEWS FOR A BETTER TOMORROW',
    description: '보건·복지, 병원·의료, 요양·시니어케어, 돌봄산업 전문 인터넷신문',
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
