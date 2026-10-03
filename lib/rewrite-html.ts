// 기사 본문 HTML을 문단 단위로 나눠, 글 문단만 다시 쓰고 사진·영상·표·목록은 그대로 둔다 (함께 송고 AI 변환용)

export type Block = { html: string; kind: 'text' | 'heading' | 'keep'; tag?: string; attrs?: string; text?: string }

const BLOCK = /<(p|h2|h3|h4|ul|ol|blockquote|table|figure|div)\b([^>]*)>[\s\S]*?<\/\1>|<img\b[^>]*>|<hr\b[^>]*>/gi

function decode(s: string) {
  return s
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d))).replace(/&amp;/g, '&')
}
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const textOf = (inner: string) => decode(inner.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()

export function splitBlocks(html: string): Block[] {
  const out: Block[] = []
  let last = 0
  for (const m of html.matchAll(BLOCK)) {
    if (m.index! > last && html.slice(last, m.index).trim()) out.push({ html: html.slice(last, m.index), kind: 'keep' })
    last = m.index! + m[0].length
    const tag = m[1]?.toLowerCase()
    const inner = tag ? m[0].slice(m[0].indexOf('>') + 1, -(`</${tag}>`.length)) : ''
    // 사진 설명(<p><em>▲ …</em></p>)·빈 문단은 그대로
    const isCaption = tag === 'p' && /^\s*<em>\s*▲/.test(inner)
    if ((tag === 'p' || tag === 'h2' || tag === 'h3' || tag === 'h4') && !isCaption && textOf(inner)) {
      out.push({ html: m[0], kind: tag === 'p' ? 'text' : 'heading', tag, attrs: m[2] ?? '', text: textOf(inner) })
    } else {
      out.push({ html: m[0], kind: 'keep' })
    }
  }
  if (html.slice(last).trim()) out.push({ html: html.slice(last), kind: 'keep' })
  return out
}

// 첫 문단 앞의 바이라인 "[매체=이름 기자]" 은 AI에 보내지 않고 따로 둔다
const BYLINE = /^\[[^\]]{1,40}기자\]\s*/

export function textsForRewrite(blocks: Block[]) {
  let byline = ''
  const texts = blocks.filter((b) => b.kind !== 'keep').map((b, i) => {
    if (i === 0 && b.kind === 'text') {
      const m = b.text!.match(BYLINE)
      if (m) { byline = m[0].trim(); return b.text!.slice(m[0].length).trim() }
    }
    return b.text!
  })
  return { byline, texts }
}

// 다시 쓴 문단을 원래 자리에 넣는다 (정렬 등 문단 속성은 그대로, 굵게·링크 같은 글자 서식은 빠진다)
export function rebuild(blocks: Block[], texts: string[], byline: string) {
  let i = 0
  return blocks.map((b) => {
    if (b.kind === 'keep') return b.html
    const t = texts[i] ?? b.text!
    const first = i === 0
    i++
    const body = first && byline && b.kind === 'text' ? `${esc(byline)}&nbsp;${esc(t)}` : esc(t)
    return `<${b.tag}${b.attrs}>${body}</${b.tag}>`
  }).join('')
}
