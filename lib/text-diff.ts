// 문단 단위 비교 (수정 이력에서 고치기 전·후 본문을 견줄 때)
//   같은 문단은 그대로, 빠진 문단은 del, 새로 생긴 문단은 add 로 돌려준다
export type DiffPart = { kind: 'same' | 'del' | 'add'; text: string }

export function diffParagraphs(before: string[], after: string[]): DiffPart[] {
  const n = before.length, m = after.length
  // LCS 길이 표 (기사 본문은 문단 수십 개라 n×m 표로 충분하다)
  const t: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      t[i][j] = before[i] === after[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1])
    }
  }
  const out: DiffPart[] = []
  let i = 0, j = 0
  while (i < n && j < m) {
    if (before[i] === after[j]) { out.push({ kind: 'same', text: before[i] }); i++; j++ }
    else if (t[i + 1][j] >= t[i][j + 1]) out.push({ kind: 'del', text: before[i++] })
    else out.push({ kind: 'add', text: after[j++] })
  }
  while (i < n) out.push({ kind: 'del', text: before[i++] })
  while (j < m) out.push({ kind: 'add', text: after[j++] })
  return out
}

// 바뀐 문단 앞뒤로 같은 문단은 한 개씩만 남기고 나머지는 "… 같은 문단 N개" 로 줄인다
export type DiffRow = DiffPart | { kind: 'skip'; count: number }

export function compactDiff(parts: DiffPart[], context = 1): DiffRow[] {
  const keep = parts.map((p, idx) => p.kind !== 'same' || parts.slice(Math.max(0, idx - context), idx + context + 1).some((q) => q.kind !== 'same'))
  const rows: DiffRow[] = []
  let skipped = 0
  parts.forEach((p, idx) => {
    if (keep[idx]) {
      if (skipped) { rows.push({ kind: 'skip', count: skipped }); skipped = 0 }
      rows.push(p)
    } else skipped++
  })
  if (skipped) rows.push({ kind: 'skip', count: skipped })
  return rows
}

const decode = (s: string) => s
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ').replace(/&middot;/g, '·').replace(/&amp;/g, '&')

const fileName = (src: string) => {
  const name = src.split('/').pop()?.split('?')[0] ?? ''
  try { return decodeURIComponent(name) } catch { return name }
}

// 본문 HTML → 비교용 문단 목록 (사진은 "[사진] 파일이름" 한 줄로)
export function htmlParagraphs(html: string | null | undefined): string[] {
  return decode(
    (html ?? '')
      .replace(/<img[^>]*?src="([^"]*)"[^>]*>/gi, (_, src: string) => `\n\n[사진] ${fileName(src)}\n\n`)
      .replace(/<\/(p|h\d|li|blockquote|figure|figcaption|div)>|<br\s*\/?>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
  )
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}
