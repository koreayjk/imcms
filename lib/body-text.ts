const HAS_TAG = /<\/?[a-z][\s\S]*?>/i

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// 편집기 도입 전의 일반 텍스트 본문을 문단 HTML로 바꾼다
export function toHtml(body: string | null | undefined) {
  const text = body ?? ''
  if (HAS_TAG.test(text)) return text
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('')
}
