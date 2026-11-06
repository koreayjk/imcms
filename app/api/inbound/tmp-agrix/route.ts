// 임시: 농림사업정보시스템 로고를 한 번 받아 오기 위한 길 (받은 뒤 바로 지운다). 주소는 고정이라 다른 곳은 받지 못한다
export const runtime = 'nodejs'
export const preferredRegion = 'icn1'
export async function GET() {
  const r = await fetch('https://uni.agrix.go.kr/webportal/images/main/top/logo.png', { headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(15000) }).catch((e) => e as Error)
  if (r instanceof Error) return new Response('fetch failed: ' + r.message, { status: 502 })
  return new Response(await r.arrayBuffer(), { status: r.status, headers: { 'content-type': r.headers.get('content-type') ?? 'application/octet-stream' } })
}
