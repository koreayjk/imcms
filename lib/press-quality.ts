// 보도자료함에 올릴 만한 자료인지 판정한다: 글이 어느 정도 길고, 사진이 있어야 한다
//   · 한국어 글: 공백을 뺀 글자 300자 이상 (지자체는 200자) / 영문 글: 150단어 이상
//   · 사진: image_url 이 있거나 본문에 <img> 가 있어야 한다. 한국·미국·해외 언론 모두 같다 (예전에는 해외 언론은 사진 조건을 보지 않았다)
//   · 직접 등록·메일로 받은 자료는 판정하지 않는다 (사람이 직접 넣은 자료)

export const MIN_KO_CHARS = 300
// 지자체(lg-) 보도자료는 짧게 쓰는 곳이 많아 기준을 낮춘다 (경기도·충남 등 200~290자 자료가 정상)
export const MIN_KO_CHARS_GOV = 200
export const MIN_EN_WORDS = 150

export type Quality = { ok: boolean; note: string }

const plain = (html: string) =>
  html.replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&[a-z#0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim()

export function judgePress(sourceKey: string, bodyHtml: string | null, imageUrl: string | null): Quality {
  const html = bodyHtml ?? ''
  const text = plain(html)
  if (!text) return { ok: false, note: '본문 없음' }
  const hangul = (text.match(/[가-힣]/g) ?? []).length
  const korean = hangul >= text.replace(/\s/g, '').length * 0.3
  if (korean) {
    const n = text.replace(/\s/g, '').length
    const min = sourceKey.startsWith('lg-') ? MIN_KO_CHARS_GOV : MIN_KO_CHARS
    if (n < min) return { ok: false, note: `글이 짧음 (${n}자)` }
  } else {
    const w = text.split(' ').length
    if (w < MIN_EN_WORDS) return { ok: false, note: `글이 짧음 (${w}단어)` }
  }
  if (!(imageUrl && imageUrl.trim()) && !/<img\b/i.test(html)) return { ok: false, note: '사진 없음' }
  return { ok: true, note: '' }
}
