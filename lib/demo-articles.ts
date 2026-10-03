import { readFileSync } from 'fs'
import type { PublicArticle } from './public-data'
import { SITES, type SiteConfig } from './sites'

// 개발용: IM_DEMO_FILE 에 {site, articles} JSON 경로를 주면 샘플 대신 그 매체·기사로 화면을 띄운다 (DB 없이 새 매체 확인)
let override: { site: SiteConfig; articles: PublicArticle[] } | null | undefined
function demoOverride() {
  if (override !== undefined) return override
  try {
    override = process.env.IM_DEMO_FILE ? JSON.parse(readFileSync(process.env.IM_DEMO_FILE, 'utf8')) : null
  } catch {
    override = null
  }
  return override
}
export const demoSite = (): SiteConfig => demoOverride()?.site ?? SITES[0]

const SAMPLES: Record<string, string[]> = {
  'health-welfare': [
    '기초생활보장 부양의무자 기준 완화, 내년 수급 대상 확대 전망',
    '지역사회 통합돌봄 전국 확대 앞두고 지자체 준비 상황 점검',
    '치매안심센터 이용자 만족도 조사…"방문 상담 늘려야"',
    '장애인 활동지원 시간 개편안, 현장 의견 수렴 나서',
    '저소득 노인 영양 지원 사업, 도시·농촌 격차 여전',
  ],
  medical: [
    '대학병원 응급실 운영 현황…야간 전문의 확보가 관건',
    '비대면 진료 제도화 논의 재점화, 의료계 "안전장치 먼저"',
    '지방 중소병원, 간호 인력 수급난에 병동 축소 잇따라',
    '필수의료 수가 조정안 발표 앞두고 병원계 촉각',
    '공공병원 확충 계획, 부지 선정 단계부터 난항',
  ],
  'senior-care': [
    '요양병원 간병비 급여화 시범사업, 참여 기관 확대 논의',
    '장기요양 재가서비스 이용 늘어…방문요양 인력은 부족',
    '요양시설 입소 대기 장기화, 수도권 대기자 증가세',
    '시니어 주거 수요 증가…입주 비용 부담은 과제',
    '요양보호사 처우 개선 방안, 현장에서는 "임금 체계부터"',
  ],
  'care-industry': [
    '돌봄 로봇·센서 도입 확산, 재가 어르신 안전 관리에 활용',
    '사회서비스원 설립 지역 늘어…공공 돌봄 역할 커진다',
    '돌봄 스타트업, 투자 위축 속 공공사업으로 활로 모색',
    '아이돌봄·노인돌봄 통합 플랫폼 시범 운영 시작',
    '돌봄 종사자 교육 과정 표준화 추진',
  ],
  politics: [
    '국회 보건복지위, 돌봄 관련 법안 심사 본격화',
    '지방선거 앞두고 돌봄 공약 경쟁…실효성 검증 필요',
    '저출생·고령사회 대책 예산안, 여야 입장차 뚜렷',
    '정부 조직개편 논의 속 복지 전담 부처 위상 주목',
    '지자체 복지 재정 분담 비율 조정 논의',
  ],
  economy: [
    '고령친화산업 시장 커진다…헬스케어 기업 진출 활발',
    '의료기기 수출 회복세, 중소기업 해외 인증 지원 확대',
    '실손보험 청구 간소화 시행 이후 병원 현장 변화는',
    '시니어 소비 트렌드 변화…건강·여가 지출 비중 늘어',
    '돌봄 서비스 가격 현실화 요구 커져',
  ],
  society: [
    '1인 가구 고독사 예방 위한 안부 확인 서비스 확대',
    '경로당 활용한 건강 프로그램, 참여 어르신 호응',
    '폭염 대비 취약계층 보호 대책…무더위 쉼터 점검',
    '가족돌봄청년 지원 사각지대 여전',
    '지역 자원봉사단, 독거노인 반찬 나눔 이어가',
  ],
  culture: [
    '어르신 디지털 문해 교육, 도서관 중심으로 확산',
    '치유농업 프로그램, 정서 돌봄 효과 주목',
    '노년의 삶 다룬 다큐멘터리 상영회 열려',
    '지역 문화센터 세대 통합 프로그램 인기',
    '시니어 합창단, 요양시설 찾아 위문 공연',
  ],
}

const NAMES: Record<string, string> = {
  'health-welfare': '보건·복지', medical: '병원·의료', 'senior-care': '요양·시니어케어',
  'care-industry': '돌봄산업', politics: '정치', economy: '경제', society: '사회', culture: '문화',
}

const ORDER = ['senior-care', 'medical', 'health-welfare', 'care-industry', 'society', 'economy', 'politics', 'culture']

let cache: PublicArticle[] | null = null

export function demoArticles(): PublicArticle[] {
  if (cache) return cache
  const o = demoOverride()
  if (o) return (cache = o.articles)
  const now = Date.now()
  const out: PublicArticle[] = []
  for (let i = 0; i < 5; i++) {
    ORDER.forEach((slug, j) => {
      const n = out.length
      const title = SAMPLES[slug][i]
      out.push({
        id: `demo-${slug}-${i}`,
        title,
        excerpt: '샘플 기사입니다. 실제 기사가 발행되면 이 자리에 기사의 리드문이 표시됩니다.',
        body: '이 기사는 홈페이지 레이아웃을 확인하기 위한 샘플입니다.\n\nCMS에서 기사를 작성하고 편집장 승인을 거쳐 발행하면, 이 자리에 실제 기사 본문이 표시됩니다.',
        thumbnail_url: (i + j) % 4 === 3 ? null : `https://picsum.photos/seed/care${n}/800/500`,
        published_at: new Date(now - n * 47 * 60 * 1000).toISOString(),
        view_count: ((n * 7919) % 900) + 50,
        is_featured: i === 0 && j < 3,
        author_name: '편집국',
        category: { slug, name: NAMES[slug] },
        tags: null,
      })
    })
  }
  cache = out
  return out
}
