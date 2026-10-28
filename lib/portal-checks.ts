import type { SiteConfig } from './sites'

// 포털(다음·네이트·줌·MSN 등) 제휴 신청 전 점검. 포털마다 심사 기준이 다르고 바뀌므로, 여기 항목은 "공통으로 늘 요구되는 것"과
//   우리 매체 화면에서 확인할 수 있는 것만 본다. 통과를 보장하지 않는다
export type Check = {
  id: string
  group: 'required' | 'recommended'
  label: [string, string]
  ok: boolean
  detail: [string, string]
  // 고치는 곳 (홈페이지 설정 등)
  fix?: 'settings'
}

export type RecentStats = {
  published: number // 지금까지 발행한 기사 수
  last30: number // 최근 30일 발행
  noByline: number // 최근 30일 중 기자명이 없는 기사
  noExcerpt: number
  noThumb: number
  dupTitles: number // 최근 30일 중 같은 제목이 겹친 기사 수
  reporters: number // 최근 30일 기자(이름) 수
  lastPublishedAt: string | null
}

const filled = (v: string | undefined | null) => !!v && v.trim().length > 0

export function portalChecks(site: SiteConfig, st: RecentStats): Check[] {
  const l = site.legal
  const out: Check[] = []
  const legal = (id: string, key: keyof typeof l, ko: string, en: string) =>
    out.push({ id, group: 'required', label: [`${ko} 표기`, `${en} shown in footer`], ok: filled(l[key]), detail: filled(l[key]) ? [l[key], l[key]] : [`하단 표시 정보에 ${ko}이(가) 비어 있습니다.`, `${en} is empty in the footer information.`], fix: 'settings' })
  legal('legal-reg', 'registrationNo', '등록번호', 'Registration no.')
  legal('legal-regat', 'registeredAt', '등록일', 'Registration date')
  legal('legal-publisher', 'publisher', '발행인', 'Publisher')
  legal('legal-editor', 'editor', '편집인', 'Editor')
  legal('legal-youth', 'youthOfficer', '청소년보호책임자', 'Youth protection officer')
  legal('legal-address', 'address', '발행소 주소', 'Publishing address')
  legal('legal-phone', 'phone', '대표 전화', 'Phone')
  legal('legal-email', 'email', '대표 이메일', 'Email')
  out.push({ id: 'domain', group: 'required', label: ['도메인 연결', 'Domain connected'], ok: site.domains.length > 0, detail: site.domains.length ? [site.domains[0], site.domains[0]] : ['연결된 도메인이 없습니다.', 'No domain is connected.'] })
  out.push({ id: 'open', group: 'required', label: ['정식 오픈 (오픈 준비 중 아님)', 'Launched (not in “opening soon” mode)'], ok: !site.comingSoon, detail: !site.comingSoon ? ['방문자에게 홈페이지가 보입니다.', 'Visitors can see the website.'] : ['“오픈 준비 중” 화면이 켜져 있습니다.', 'The “opening soon” page is on.'] })
  out.push({ id: 'index', group: 'required', label: ['검색 노출 켜짐', 'Search visibility on'], ok: site.indexable, detail: site.indexable ? ['검색 로봇의 수집을 허용합니다.', 'Search crawlers are allowed.'] : ['검색 노출이 꺼져 있어 포털·검색이 수집하지 못합니다.', 'Search visibility is off, so portals and search engines cannot collect the site.'], fix: 'settings' })
  out.push({ id: 'byline', group: 'required', label: ['기사마다 기자 이름', 'Every story has a reporter name'], ok: st.last30 > 0 && st.noByline === 0, detail: st.last30 === 0 ? ['최근 30일 발행 기사가 없어 확인할 수 없습니다.', 'No stories in the last 30 days to check.'] : st.noByline === 0 ? ['최근 30일 기사 모두 기자 이름이 있습니다.', 'All stories in the last 30 days have a name.'] : [`최근 30일 기사 중 ${st.noByline}건에 기자 이름이 없습니다.`, `${st.noByline} stories in the last 30 days have no reporter name.`] })
  out.push({ id: 'dups', group: 'required', label: ['같은 제목 기사 없음', 'No duplicate headlines'], ok: st.dupTitles === 0, detail: st.dupTitles === 0 ? ['최근 30일 안에 같은 제목이 없습니다.', 'No duplicate headlines in the last 30 days.'] : [`최근 30일 안에 같은 제목이 겹치는 기사가 ${st.dupTitles}건 있습니다 (중복 기사는 제휴 평가에서 감점됩니다).`, `${st.dupTitles} stories share a headline within 30 days (duplicates are penalized in partner reviews).`] })

  out.push({ id: 'volume', group: 'recommended', label: ['꾸준한 발행 (최근 30일 30건 이상)', 'Steady publishing (30+ stories in 30 days)'], ok: st.last30 >= 30, detail: [`최근 30일 ${st.last30}건 · 전체 ${st.published}건. 30건은 우리 권장 기준이며 포털 공식 기준이 아닙니다.`, `${st.last30} stories in the last 30 days · ${st.published} in total. 30 is our own guideline, not an official portal threshold.`] })
  out.push({ id: 'recent', group: 'recommended', label: ['최근 7일 안에 발행', 'Published within the last 7 days'], ok: !!st.lastPublishedAt && Date.now() - Date.parse(st.lastPublishedAt) < 7 * 86_400_000, detail: st.lastPublishedAt ? [`마지막 발행: ${st.lastPublishedAt.slice(0, 10)}`, `Last published: ${st.lastPublishedAt.slice(0, 10)}`] : ['발행한 기사가 없습니다.', 'Nothing has been published.'] })
  out.push({ id: 'reporters', group: 'recommended', label: ['기자 2명 이상 활동', 'Two or more reporters active'], ok: st.reporters >= 2, detail: [`최근 30일 기자 ${st.reporters}명`, `${st.reporters} reporter(s) in the last 30 days`] })
  out.push({ id: 'excerpt', group: 'recommended', label: ['기사마다 요약(부제)', 'Every story has a summary'], ok: st.last30 > 0 && st.noExcerpt === 0, detail: st.last30 === 0 ? ['확인할 기사가 없습니다.', 'No stories to check.'] : st.noExcerpt === 0 ? ['모든 기사에 요약이 있습니다.', 'All stories have a summary.'] : [`${st.noExcerpt}건에 요약이 없습니다.`, `${st.noExcerpt} stories have no summary.`] })
  out.push({ id: 'thumb', group: 'recommended', label: ['기사마다 대표 사진', 'Every story has a lead photo'], ok: st.last30 > 0 && st.noThumb === 0, detail: st.last30 === 0 ? ['확인할 기사가 없습니다.', 'No stories to check.'] : st.noThumb === 0 ? ['모든 기사에 대표 사진이 있습니다.', 'All stories have a lead photo.'] : [`${st.noThumb}건에 대표 사진이 없습니다.`, `${st.noThumb} stories have no lead photo.`] })
  out.push({ id: 'desc', group: 'recommended', label: ['매체 소개 문구 (30자 이상)', 'Outlet description (30+ characters)'], ok: (site.description ?? '').trim().length >= 30, detail: [`${(site.description ?? '').trim().length}자`, `${(site.description ?? '').trim().length} characters`], fix: 'settings' })
  out.push({ id: 'image', group: 'recommended', label: ['로고·대표 이미지', 'Logo and share image'], ok: filled(site.logoMark) && filled(site.ogImage), detail: [filled(site.logoMark) && filled(site.ogImage) ? '로고와 공유 대표 이미지가 있습니다.' : '로고 또는 공유 대표 이미지가 비어 있습니다.', filled(site.logoMark) && filled(site.ogImage) ? 'Logo and share image are set.' : 'Logo or share image is missing.'], fix: 'settings' })
  out.push({ id: 'sections', group: 'recommended', label: ['섹션 3개 이상', 'Three or more sections'], ok: site.sections.length >= 3, detail: [`섹션 ${site.sections.length}개`, `${site.sections.length} sections`] })
  out.push({ id: 'ainotice', group: 'recommended', label: ['AI 활용 표시 켜기 (AI로 쓴 기사가 있을 때)', 'AI disclosure on (when AI is used)'], ok: !!site.aiNotice?.on, detail: [site.aiNotice?.on ? 'AI 활용 표시가 켜져 있습니다.' : 'AI로 작성·보조한 기사가 있다면 켜 두세요. 표시하지 않으면 제휴 평가에서 감점될 수 있습니다.', site.aiNotice?.on ? 'AI disclosure is on.' : 'Turn it on if any stories are written or assisted by AI; not disclosing can cost points in partner reviews.'], fix: 'settings' })
  return out
}
