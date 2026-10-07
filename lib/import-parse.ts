// 다른 프로그램(ND소프트·미디어온 등)에서 받은 자료 읽기 — 브라우저에서 돌린다 (파일을 서버에 올리지 않는다)
//   · DB 백업(.sql, MySQL/MariaDB mysqldump): CREATE TABLE 로 칸 이름, INSERT … VALUES 로 기사 행을 읽는다
//   · CSV/TSV: 첫 줄이 칸 이름
//   · IM 뉴스룸 내보내기(JSON)
import { EXPORT_FORMAT } from './data-export'

export type Cell = string | null
export type Table = { name: string; columns: string[]; rows: Record<string, Cell>[] }
export type SqlTableInfo = { name: string; columns: string[]; inserts: number[]; bytes: number }

// 글자 인코딩: UTF-8이 아니면 옛 한국어 인코딩(EUC-KR/CP949)으로 읽는다
export function decodeText(bytes: Uint8Array): { text: string; encoding: 'utf-8' | 'euc-kr' } {
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^﻿/, ''), encoding: 'utf-8' }
  } catch {
    return { text: new TextDecoder('euc-kr').decode(bytes), encoding: 'euc-kr' }
  }
}

const IDENT = String.raw`[\`"\[]?([\w$]+)[\`"\]]?`
const NOT_COLUMN = /^(primary|key|unique|constraint|index|fulltext|spatial|foreign|check|period)\b/i

// ───────── DB 백업(.sql) ─────────
export function sqlTables(text: string): SqlTableInfo[] {
  const tables = new Map<string, SqlTableInfo>()
  const create = new RegExp(String.raw`CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:${IDENT}\.)?${IDENT}\s*\(`, 'gi')
  for (let m; (m = create.exec(text)); ) {
    const name = m[2]
    // 괄호 짝을 맞춰 표 정의 끝을 찾는다
    let depth = 1
    let i = create.lastIndex
    let quote = ''
    for (; i < text.length && depth > 0; i++) {
      const c = text[i]
      if (quote) { if (c === '\\') i++; else if (c === quote) quote = '' }
      else if (c === "'" || c === '"') quote = c
      else if (c === '(') depth++
      else if (c === ')') depth--
    }
    const columns: string[] = []
    for (const line of text.slice(create.lastIndex, i - 1).split(/,\s*\n|\n/)) {
      const t = line.trim()
      if (!t || NOT_COLUMN.test(t)) continue
      const c = t.match(new RegExp(`^${IDENT}\\s+\\w`))
      if (c) columns.push(c[1])
    }
    tables.set(name.toLowerCase(), { name, columns, inserts: [], bytes: 0 })
  }
  const insert = new RegExp(String.raw`INSERT\s+(?:IGNORE\s+)?INTO\s+(?:${IDENT}\.)?${IDENT}`, 'gi')
  let last: SqlTableInfo | null = null
  let lastAt = 0
  for (let m; (m = insert.exec(text)); ) {
    if (last) last.bytes += m.index - lastAt
    const key = m[2].toLowerCase()
    let t = tables.get(key)
    if (!t) { t = { name: m[2], columns: [], inserts: [], bytes: 0 }; tables.set(key, t) }
    t.inserts.push(m.index)
    last = t
    lastAt = m.index
  }
  if (last) last.bytes += text.length - lastAt
  return [...tables.values()].filter((t) => t.inserts.length)
}

const ESC: Record<string, string> = { n: '\n', r: '\r', t: '\t', '0': '\0', Z: '\x1a', b: '\b' }

// INSERT 문 하나의 VALUES (…),(…); 를 읽는다
function readValues(text: string, at: number, onRow: (cells: Cell[]) => void) {
  let i = at
  const n = text.length
  const ws = () => { while (i < n && /\s/.test(text[i])) i++ }
  for (;;) {
    ws()
    if (text[i] === ',') { i++; continue }
    if (text[i] !== '(') return i
    i++
    const cells: Cell[] = []
    for (;;) {
      ws()
      // 문자열 앞 표시 (N'…', _utf8mb4'…', _binary'…')
      const pre = text.slice(i, i + 12).match(/^(N|_\w+\s*)'/)
      if (pre) i += pre[0].length - 1
      if (text[i] === "'" || text[i] === '"') {
        const q = text[i++]
        let out = ''
        let from = i
        for (;;) {
          const c = text[i]
          if (c === undefined) break
          if (c === '\\') { out += text.slice(from, i) + (ESC[text[i + 1]] ?? text[i + 1]); i += 2; from = i; continue }
          if (c === q) {
            if (text[i + 1] === q) { out += text.slice(from, i) + q; i += 2; from = i; continue }
            out += text.slice(from, i)
            i++
            break
          }
          i++
        }
        cells.push(out)
      } else {
        let j = i
        while (j < n && text[j] !== ',' && text[j] !== ')') j++
        const raw = text.slice(i, j).trim()
        cells.push(/^null$/i.test(raw) ? null : raw)
        i = j
      }
      ws()
      if (text[i] === ',') { i++; continue }
      if (text[i] === ')') { i++; break }
      return i // 깨진 행
    }
    onRow(cells)
  }
}

export function sqlRows(text: string, info: SqlTableInfo, limit = Infinity): Table {
  const rows: Record<string, Cell>[] = []
  let columns = info.columns
  const head = new RegExp(String.raw`^INSERT\s+(?:IGNORE\s+)?INTO\s+(?:${IDENT}\.)?${IDENT}\s*(\(([^)]*)\))?\s*VALUES\s*`, 'i')
  for (const at of info.inserts) {
    if (rows.length >= limit) break
    const m = text.slice(at, at + 4000).match(head)
    if (!m) continue
    const cols = m[4] ? m[4].split(',').map((c) => c.trim().replace(/^[`"\[]|[`"\]]$/g, '')) : columns
    if (m[4] && !columns.length) columns = cols
    readValues(text, at + m[0].length, (cells) => {
      if (rows.length >= limit) return
      const row: Record<string, Cell> = {}
      cells.forEach((v, k) => { row[cols[k] ?? `col${k + 1}`] = v })
      rows.push(row)
    })
  }
  if (!columns.length && rows[0]) columns = Object.keys(rows[0])
  return { name: info.name, columns, rows }
}

// ───────── CSV / TSV ─────────
export function csvTable(text: string, name = 'CSV'): Table {
  const firstLine = text.slice(0, text.indexOf('\n') >>> 0)
  const sep = (firstLine.match(/\t/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? '\t' : ','
  const records: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else quoted = false }
      else cell += c
    } else if (c === '"' && cell === '') quoted = true
    else if (c === sep) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((x) => x !== '')) records.push(row)
      row = []
    } else cell += c
  }
  if (cell !== '' || row.length) { row.push(cell); records.push(row) }
  const columns = (records.shift() ?? []).map((c, i) => c.trim() || `col${i + 1}`)
  return { name, columns, rows: records.map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i] ?? null]))) }
}

// ───────── IM 뉴스룸 내보내기(JSON) ─────────
export type ImExport = { outlet?: { name?: string; domain?: string | null }; sections?: { slug: string; name: string }[]; articles: Record<string, unknown>[] }
export function imExport(text: string): ImExport | null {
  try {
    const j = JSON.parse(text)
    return j?.format === EXPORT_FORMAT && Array.isArray(j.articles) ? j : null
  } catch {
    return null
  }
}

// ───────── 칸 맞추기 ─────────
export const FIELDS = [
  { key: 'legacy_id', label: '옛 기사 번호', hint: '옛 기사 주소(…idxno=123)를 새 기사로 연결합니다', need: false },
  { key: 'title', label: '제목', need: true },
  { key: 'subtitle', label: '부제·요약', need: false },
  { key: 'body', label: '본문', need: true },
  { key: 'published_at', label: '발행일', need: true },
  { key: 'section', label: '섹션', need: false },
  { key: 'byline', label: '기자 이름', need: false },
  { key: 'thumbnail', label: '대표 사진', need: false },
  { key: 'tags', label: '키워드(태그)', need: false },
  { key: 'views', label: '조회수', need: false },
] as const
export type FieldKey = (typeof FIELDS)[number]['key']
export type Mapping = Partial<Record<FieldKey, string>>

const GUESS: Record<FieldKey, RegExp[]> = {
  legacy_id: [/^idxno$/i, /^(art_?)?(idx|no|num|uid)$/i, /^(article_?)?id$/i, /^aid$/i],
  title: [/^(art_?)?(title|subject)$/i, /^headline$/i, /제목/, /title/i, /subject/i],
  subtitle: [/^(sub_?title|subhead|summary|lead|excerpt|description)$/i, /부제|요약/, /sub_?title|summary/i],
  body: [/^(art_?)?(content|contents|body|article|text|memo)$/i, /본문|내용/, /content|body/i],
  published_at: [/^(pub|publish|published|embargo|service|release|reg|wr|w|write|input|created?)_?(date|time|day|dt|at)$/i, /^(regdate|wdate|pubdate|date|datetime)$/i, /발행|등록|작성일/, /date|time/i],
  section: [/^(sc_)?section(_?code)?$/i, /^(category|cate|cat|code|part)(_?(code|id|name))?$/i, /섹션|분류|카테고리/, /section|cate/i],
  byline: [/^(writer|author|reporter|byline|name|wr_name|user_name|username|nick)$/i, /기자|작성자|글쓴이/, /writer|author|reporter|byline/i],
  thumbnail: [/^(thumb|thumbnail|photo|image|img|main_?(photo|image|img)|rep_?(photo|image|img)|file)(_?(name|url|path))?$/i, /사진|이미지/, /thumb|photo|image|img/i],
  tags: [/^(tag|tags|keyword|keywords)$/i, /키워드|태그/, /keyword|tag/i],
  views: [/^(hit|hits|view|views|view_?count|read_?count|readnum|count)$/i, /조회/, /hit|view/i],
}

export function guessMapping(columns: string[]): Mapping {
  const used = new Set<string>()
  const out: Mapping = {}
  for (const f of FIELDS) {
    for (const re of GUESS[f.key]) {
      const c = columns.find((x) => !used.has(x) && re.test(x))
      if (c) { out[f.key] = c; used.add(c); break }
    }
  }
  return out
}

// 기사 표 고르기: 제목·본문 칸이 있고 자료가 가장 많은 표
export function guessArticleTable(tables: SqlTableInfo[]) {
  const score = (t: SqlTableInfo) => {
    const m = guessMapping(t.columns)
    return (m.title ? 4 : 0) + (m.body ? 4 : 0) + (m.published_at ? 2 : 0) + (/news|article|arti|bbs|board|post/i.test(t.name) ? 2 : 0) + Math.log10(1 + t.bytes)
  }
  return [...tables].sort((a, b) => score(b) - score(a))[0] ?? null
}

// ───────── 값 바꾸기 ─────────
const kst = (y: number, mo: number, d: number, h = 0, mi = 0, s = 0) => new Date(Date.UTC(y, mo - 1, d, h - 9, mi, s))

// 발행일: 2023-10-05 14:30:00(한국 시각) · 2023.10.05 · 20231005143000 · 유닉스 시각(초·밀리초) · ISO
export function parseDate(v: Cell): string | null {
  const s = (v ?? '').trim()
  if (!s || /^0{4}-0{2}-0{2}/.test(s)) return null
  let d: Date | null = null
  if (/^\d{10}$/.test(s)) d = new Date(Number(s) * 1000)
  else if (/^\d{13}$/.test(s)) d = new Date(Number(s))
  else if (/[T ]\d{1,2}:\d{2}.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) d = new Date(s)
  else {
    let m = s.match(/^(\d{4})[-./년]\s*(\d{1,2})[-./월]\s*(\d{1,2})일?(?:[ T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/)
    if (!m) m = s.match(/^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?$/)
    if (m) d = kst(+m[1], +m[2], +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0))
  }
  return d && !isNaN(d.getTime()) && d.getUTCFullYear() > 1980 && d.getTime() < Date.now() + 366 * 86_400_000 ? d.toISOString() : null
}

const ENTITY: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", apos: "'", nbsp: ' ' }
function unescapeHtml(s: string) {
  return s.replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, k) => ENTITY[k])
}

// 본문: HTML이면 그대로, 태그가 글자로 저장돼 있으면 되살리고, 그냥 글이면 문단으로 나눈다
export function toBodyHtml(v: Cell) {
  let s = (v ?? '').trim()
  if (!/<[a-z][\s\S]*>/i.test(s) && /&lt;(p|br|div|img|span)\b/i.test(s)) s = unescapeHtml(s)
  if (/<(p|br|div|img|table|figure|h\d|span|strong|b)\b/i.test(s)) return s
  return s.split(/\r?\n\s*\r?\n|\r?\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`).join('')
}

export function plainText(html: string) {
  return unescapeHtml(html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

// ───────── 사진 짝짓기 ─────────
// 본문 속 사진 주소(/news/photo/202310/123_456_1.jpg, http://옛도메인/…)를 ZIP 안 파일과 맞춘다
export function photoKey(path: string) {
  let p = path.trim()
  try { p = decodeURI(p) } catch { /* 그대로 */ }
  return p.replace(/^[a-z]+:\/\/[^/]+/i, '').split(/[?#]/)[0].replace(/\\/g, '/').replace(/^\.?\/+/, '').toLowerCase()
}

export class PhotoIndex {
  // ZIP 안 경로의 모든 뒷부분(a/b/c.jpg → a/b/c.jpg, b/c.jpg, c.jpg) → 새 주소. 둘 이상이면 null(애매함)
  private tails = new Map<string, string | null>()
  private count = 0
  get size() { return this.count }
  add(zipPath: string, url: string) {
    const seg = photoKey(zipPath).split('/').filter(Boolean)
    if (!seg.length) return
    this.count++
    for (let i = 0; i < seg.length; i++) {
      const k = seg.slice(i).join('/')
      const had = this.tails.get(k)
      this.tails.set(k, had === undefined || had === url ? url : i === 0 ? url : null)
    }
  }
  // 주소의 긴 뒷부분부터 맞춰 본다 (도메인·앞 폴더가 달라도 연도 폴더/파일 이름이 같으면 같은 사진)
  resolve(src: string | null | undefined) {
    if (!src) return null
    const seg = photoKey(src).split('/').filter(Boolean)
    for (let i = 0; i < seg.length; i++) {
      const hit = this.tails.get(seg.slice(i).join('/'))
      if (hit) return hit
    }
    return null
  }
}

// 본문 사진 주소 바꾸기 → 바꾼 본문, 못 찾은 사진 수
export function rewriteBodyImages(html: string, index: PhotoIndex) {
  let missing = 0
  const out = html.replace(/(<img\b[^>]*?\bsrc\s*=\s*)(["'])([^"']+)\2/gi, (all, head: string, q: string, src: string) => {
    if (/^data:/i.test(src)) return all
    const url = index.resolve(src)
    if (url) return `${head}${q}${url}${q}`
    if (!/^https?:\/\//i.test(src)) missing++
    return all
  })
  return { html: out, missing }
}

// 저장소에 올릴 파일 이름 (한글·특수문자는 짧은 기호로 바꾼다. 같은 이름은 늘 같은 기호)
export function storageSafe(path: string) {
  return path.replace(/\\/g, '/').split('/').filter((s) => s && s !== '.' && s !== '..').map((seg) => {
    if (/^[\w.\-]+$/.test(seg)) return seg
    let h = 2166136261
    for (const ch of seg) h = Math.imul(h ^ ch.codePointAt(0)!, 16777619) >>> 0
    const ext = seg.match(/\.([a-z0-9]{2,5})$/i)?.[1]
    return `x${h.toString(36)}${ext ? '.' + ext.toLowerCase() : ''}`
  }).join('/')
}

export const PHOTO_TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' }

// 섹션 이름 표 찾기: 기사 표의 섹션 코드(S1N1 등)가 들어 있고, 한글 이름 칸이 있는 작은 표 → 코드 → 이름
//   (ND소프트처럼 기사에는 섹션 코드만 있고 이름은 다른 표에 있는 경우)
export function sectionNameMap(text: string, tables: SqlTableInfo[], articleTable: string, codes: string[]) {
  const want = new Set(codes.map((c) => c.trim()).filter(Boolean))
  if (!want.size) return null
  let best: { score: number; map: Map<string, string>; table: string } | null = null
  for (const t of tables) {
    if (t.name === articleTable || t.bytes > 3_000_000) continue
    const { rows, columns } = sqlRows(text, t, 5000)
    if (!rows.length) continue
    for (const code of columns) {
      const hit = new Set(rows.map((r) => (r[code] ?? '').trim()).filter((v) => want.has(v)))
      if (hit.size / want.size < 0.5) continue
      for (const name of columns) {
        if (name === code) continue
        const named = rows.filter((r) => /[가-힣]/.test(r[name] ?? '')).length
        if (named / rows.length < 0.5) continue
        const score = hit.size / want.size + (/name|nm|title|명|이름/i.test(name) ? 0.2 : 0) + (/sect|cate|code|menu|part/i.test(t.name) ? 0.2 : 0)
        if (!best || score > best.score) {
          const map = new Map<string, string>()
          for (const r of rows) { const c = (r[code] ?? '').trim(); const n = plainText(r[name] ?? ''); if (c && n && !map.has(c)) map.set(c, n) }
          best = { score, map, table: t.name }
        }
      }
    }
  }
  return best ? { table: best.table, map: best.map } : null
}

// 표 구조만 (자료 내용 없이) — 자동으로 못 맞출 때 도움을 받으려고 복사한다
export function describeTables(tables: SqlTableInfo[]) {
  return tables.map((t) => `${t.name} (약 ${(t.bytes / 1e6).toFixed(1)}MB): ${t.columns.join(', ')}`).join('\n')
}
