// AI 초안 자동 점검: 원문에 없는 숫자·인용문이 들어갔는지 (사람이 최종 확인하기 전 1차 신호)

const squash = (s: string) => s.replace(/\s+/g, '').replace(/[“”"‘’']/g, '')

export type DraftIssue = { kind: 'number' | 'quote'; text: string }

export function checkDraft(original: string, draft: { title: string; subtitle: string; paragraphs: string[] }): DraftIssue[] {
  const src = original.replace(/,(?=\d{3})/g, '')
  const srcSquashed = squash(src)
  const body = [draft.title, draft.subtitle, ...draft.paragraphs].join('\n')
  const issues: DraftIssue[] = []

  // 숫자: 원문에 같은 숫자가 없으면 표시 (1,000 ↔ 1000은 같은 숫자로 본다)
  const nums = new Set(Array.from(body.replace(/,(?=\d{3})/g, '').matchAll(/\d+(?:\.\d+)?/g), (m) => m[0]))
  for (const n of Array.from(nums)) {
    if (!new RegExp(`(^|[^\\d.])${n.replace('.', '\\.')}(?![\\d])`).test(src)) issues.push({ kind: 'number', text: n })
  }

  // 인용문: 큰따옴표 안 문장(8자 이상)이 원문에 그대로 있는지
  for (const m of Array.from(body.matchAll(/[“"]([^”"]{8,})[”"]/g))) {
    if (!srcSquashed.includes(squash(m[1]))) issues.push({ kind: 'quote', text: m[1].slice(0, 60) })
  }
  return issues
}
