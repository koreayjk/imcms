import { ImageResponse } from 'next/og'
import { currentSite, getArticleData } from '@/lib/public-data'

// 기사에 사진도, 매체 공유 대표 이미지도 없을 때 쓰는 공유 미리보기 카드 (카카오톡·페이스북 등)
//   사진이 없는 기사를 링크로 보내면 메신저가 페이지 안의 엉뚱한 사진(옆 기사 등)을 대신 가져가므로, 이 카드를 늘 대표 이미지로 알려 준다
//   매체 대표색 바탕에 매체 이름과 기사 제목을 넣는다
export const runtime = 'nodejs'

async function loadFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@700&text=${encodeURIComponent(text)}`)).text()
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1]
    if (!url) return null
    const res = await fetch(url)
    return res.ok ? await res.arrayBuffer() : null
  } catch { return null }
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const site = await currentSite()
  const data = await getArticleData(site, id).catch(() => null)
  const title = (data?.article.meta_title || data?.article.title || site.name).slice(0, 80)
  const name = site.name
  const font = await loadFont(`${title}${name}0123456789`)
  const brand = site.colors.brand
  const gold = site.colors.gold
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: `linear-gradient(135deg, ${brand} 0%, ${site.colors.brandDark} 100%)`, color: '#fff', padding: '64px 72px', fontFamily: 'NotoSansKR, sans-serif' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 34, fontWeight: 700, color: gold }}>
          <div style={{ width: 44, height: 6, background: gold, display: 'flex' }} />
          {name}
        </div>
        <div style={{ display: 'flex', fontSize: title.length > 40 ? 52 : 62, fontWeight: 700, lineHeight: 1.35, letterSpacing: '-0.02em', wordBreak: 'keep-all' }}>{title}</div>
        <div style={{ display: 'flex', height: 6, width: 160, background: gold }} />
      </div>
    ),
    {
      width: 1200,
      height: 630,
      ...(font ? { fonts: [{ name: 'NotoSansKR', data: font, weight: 700 as const, style: 'normal' as const }] } : {}),
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' },
    },
  )
}
