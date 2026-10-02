import type { Editor } from '@tiptap/react'
import type { Mark } from '@tiptap/pm/model'

// AI가 옮겨 적은 문장을 본문에서 찾을 때, 따옴표 모양·띄어쓰기 차이는 같은 글자로 본다
function normChar(c: string) {
  if (/[“”„‟"]/.test(c)) return '"'
  if (/[‘’‚‛']/.test(c)) return "'"
  if (/\s/.test(c)) return ' '
  return c
}

// 원문 글자마다 위치를 기억하며 정규화한다 (연속 공백은 하나로)
function normalize(text: string, at: (i: number) => number) {
  let out = ''
  const map: number[] = []
  for (let i = 0; i < text.length; i++) {
    const c = normChar(text[i])
    if (c === ' ' && (out === '' || out.endsWith(' '))) continue
    out += c
    map.push(at(i))
  }
  return { out, map }
}

const normQuote = (q: string) => normalize(q.trim(), (i) => i).out.trim()

// 제목·부제처럼 그냥 글자일 때
export function findInText(text: string, quote: string): [number, number] | null {
  const q = normQuote(quote)
  if (!q) return null
  const { out, map } = normalize(text, (i) => i)
  const idx = out.indexOf(q)
  if (idx < 0) return null
  return [map[idx], map[idx + q.length - 1] + 1]
}

export function replaceInText(text: string, quote: string, fix: string) {
  const r = findInText(text, quote)
  return r ? text.slice(0, r[0]) + fix + text.slice(r[1]) : null
}

// 본문(에디터)에서 찾기: 한 문단 안에서만 찾는다. 굵게·링크 등 서식이 섞여 있어도 찾는다
function findInEditor(editor: Editor, quote: string): { from: number; to: number } | null {
  const q = normQuote(quote)
  if (!q) return null
  let found: { from: number; to: number } | null = null
  editor.state.doc.descendants((node, pos) => {
    if (found) return false
    if (!node.isTextblock) return true
    let text = ''
    const at: number[] = []
    node.forEach((child, offset) => {
      if (child.isText && child.text) {
        for (let i = 0; i < child.text.length; i++) { text += child.text[i]; at.push(pos + 1 + offset + i) }
      } else {
        text += '￼'
        at.push(pos + 1 + offset)
      }
    })
    const { out, map } = normalize(text, (i) => at[i])
    const idx = out.indexOf(q)
    if (idx >= 0) found = { from: map[idx], to: map[idx + q.length - 1] + 1 }
    return false
  })
  return found
}

export function canReplaceInEditor(editor: Editor | null, quote: string) {
  return !!editor && !!findInEditor(editor, quote)
}

export function replaceInEditor(editor: Editor, quote: string, fix: string) {
  const r = findInEditor(editor, quote)
  if (!r) return false
  // 바꾼 문장에는 원래 문장 전체에 공통인 서식만 남긴다 (일부만 굵게였으면 굵게를 빼고 넣는다)
  const { state } = editor
  let common: readonly Mark[] | null = null
  state.doc.nodesBetween(r.from, r.to, (n) => {
    if (n.isText) common = common ? common.filter((m) => m.isInSet(n.marks)) : n.marks
  })
  editor.chain().command(({ tr }) => { tr.replaceWith(r.from, r.to, state.schema.text(fix, common ?? [])); return true }).run()
  return true
}
