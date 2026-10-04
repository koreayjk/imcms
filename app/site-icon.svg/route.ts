import { currentSite } from '@/lib/public-data'

// 로고가 없는 매체의 탭 아이콘: 매체 이름 첫 글자 + 대표 색 (lib/sites.ts siteIcon)
export const dynamic = 'force-dynamic'

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

export async function GET() {
  const site = await currentSite()
  const letter = esc(Array.from(site.name.replace(/^IM\s+/, '').trim())[0] ?? 'N')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${esc(site.colors.brand)}"/><text x="32" y="44" text-anchor="middle" font-family="Pretendard, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif" font-size="34" font-weight="800" fill="#fff">${letter}</text></svg>`
  return new Response(svg, { headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' } })
}
