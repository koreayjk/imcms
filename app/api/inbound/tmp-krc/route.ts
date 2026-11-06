// 임시: 한국농어촌공사 로고 주소를 찾아 받아 오는 길 (받은 뒤 바로 지운다). 대상은 고정이라 다른 곳은 받지 못한다
export const runtime = 'nodejs'
export const preferredRegion = 'icn1'
const BASE = 'https://www.ekr.or.kr'
const UA = { 'user-agent': 'Mozilla/5.0' }
export async function GET(req: Request) {
  const p = new URL(req.url).searchParams.get('p')
  try {
    if (p && /^\/[A-Za-z0-9_\-./]+\.(png|jpg|jpeg|svg|gif|webp)$/.test(p)) {
      const r = await fetch(BASE + p, { headers: UA, signal: AbortSignal.timeout(15000) })
      return new Response(await r.arrayBuffer(), { status: r.status, headers: { 'content-type': r.headers.get('content-type') ?? 'application/octet-stream' } })
    }
    const r = await fetch(BASE + '/', { headers: UA, signal: AbortSignal.timeout(15000) })
    const html = await r.text()
    const imgs = [...html.matchAll(/<img[^>]+>/gi)].map((m) => m[0]).filter((x) => /logo/i.test(x)).slice(0, 20)
    const css = [...html.matchAll(/href="([^"]+\.css[^"]*)"/gi)].map((m) => m[1]).slice(0, 20)
    const hdr = html.slice(html.search(/<header/i), html.search(/<header/i) + 1500)
    return Response.json({ status: r.status, imgs, css, hdr })
  } catch (e) {
    return new Response('fetch failed: ' + (e as Error).message, { status: 502 })
  }
}
