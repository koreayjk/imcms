// 지역 담당 기자 (자동 작성과 보도자료함 AI 기사 만들기가 같이 쓴다)
//   auto_press_outlets.region_bylines: [{ byline, sources: [출처 키…], keywords: [지역 낱말…] }, …] (supabase/auto-press-region-bylines.sql)
//   · 보도자료 출처(예: lg-incheon)가 sources 에 있으면 그 기자
//   · 지자체 출처(lg-…)가 아닌 자료(메일·분야별)는 제목·요약에 keywords 낱말이 있을 때만
//   · 어디에도 안 맞으면 null (호출한 쪽이 기본 기자를 쓴다)
export type RegionByline = { byline: string; sources?: string[]; keywords?: string[] }

export function pickRegionByline(groups: RegionByline[] | null | undefined, r: { source_key: string; title: string; summary?: string | null }): string | null {
  const local = r.source_key.startsWith('lg-')
  const text = `${r.title} ${r.summary ?? ''}`
  for (const g of groups ?? []) {
    if (!g.byline) continue
    if (g.sources?.includes(r.source_key)) return g.byline
    if (!local && g.keywords?.some((k) => k && text.includes(k))) return g.byline
  }
  return null
}
