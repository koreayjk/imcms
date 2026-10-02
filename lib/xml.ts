// XML 특수문자 처리
export const xml = (s: string | null | undefined) =>
  (s ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')

export function xmlResponse(body: string, type = 'application/xml') {
  return new Response(body, { headers: { 'Content-Type': `${type}; charset=utf-8`, 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=600' } })
}
