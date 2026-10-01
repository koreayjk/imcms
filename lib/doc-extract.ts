// 워드(.doc·.docx)·텍스트(.txt) 보도자료에서 본문 글자만 뽑는다.
// 브라우저에서 돌린다: 사진이 든 큰 파일도 서버로 보내지 않고 글자만 넘기기 위해서
import * as CFB from 'cfb'
import { unzipSync, strFromU8 } from 'fflate'

export class DocExtractError extends Error {}

export const DOC_ACCEPT = '.doc,.docx,.txt'

export async function extractDocText(file: File): Promise<string> {
  const name = file.name.toLowerCase()
  const bytes = new Uint8Array(await file.arrayBuffer())
  let text: string
  if (name.endsWith('.docx')) text = docxText(bytes)
  else if (name.endsWith('.doc')) text = isZip(bytes) ? docxText(bytes) : wordText(bytes)
  else if (name.endsWith('.txt')) text = plainText(bytes)
  else if (name.endsWith('.hwp') || name.endsWith('.hwpx')) throw new DocExtractError('한글(.hwp) 파일은 아직 읽지 못합니다. 한글에서 “다른 이름으로 저장 → .docx”로 바꿔 올려 주세요.')
  else throw new DocExtractError('워드(.doc, .docx)나 텍스트(.txt) 파일만 올릴 수 있습니다.')
  text = tidy(text)
  if (text.length < 50) throw new DocExtractError('파일에서 글자를 거의 찾지 못했습니다. 그림으로만 된 문서인지 확인해 주세요.')
  return text
}

const isZip = (b: Uint8Array) => b[0] === 0x50 && b[1] === 0x4b

// ───────── .doc (Word 97~2003): CFB 안의 WordDocument 스트림 + 조각표(piece table) ─────────
function wordText(bytes: Uint8Array): string {
  let cfb: CFB.CFB$Container
  try {
    cfb = CFB.read(bytes, { type: 'array' })
  } catch {
    throw new DocExtractError('워드 파일을 열지 못했습니다. 파일이 손상되었거나 다른 형식일 수 있습니다.')
  }
  const stream = (n: string) => {
    const e = CFB.find(cfb, n)
    return e?.content ? Uint8Array.from(e.content as ArrayLike<number>) : null
  }
  const wd = stream('WordDocument')
  if (!wd) throw new DocExtractError('워드 문서 본문을 찾지 못했습니다.')
  const dv = new DataView(wd.buffer, wd.byteOffset, wd.byteLength)
  if (dv.getUint16(0, true) !== 0xa5ec) throw new DocExtractError('지원하지 않는 워드 형식입니다. .docx로 저장해 올려 주세요.')
  const flags = dv.getUint16(0x0a, true)
  if (flags & 0x0100) throw new DocExtractError('암호가 걸린 워드 파일은 읽을 수 없습니다.')
  const table = stream(flags & 0x0200 ? '1Table' : '0Table')
  if (!table) throw new DocExtractError('워드 문서 구조를 찾지 못했습니다.')
  const ccpText = dv.getInt32(0x4c, true) // 본문 글자 수 (각주·머리말 제외)
  const fcClx = dv.getUint32(0x1a2, true)
  const lcbClx = dv.getUint32(0x1a6, true)
  const tv = new DataView(table.buffer, table.byteOffset, table.byteLength)

  // Clx: Prc(0x01) 묶음을 건너뛰고 Pcdt(0x02)를 찾는다
  let p = fcClx
  const end = fcClx + lcbClx
  while (p < end && table[p] === 0x01) p += 3 + tv.getUint16(p + 1, true)
  if (table[p] !== 0x02) throw new DocExtractError('워드 문서의 글자 위치 정보를 찾지 못했습니다.')
  const lcb = tv.getUint32(p + 1, true)
  const plc = p + 5
  const n = (lcb - 4) / 12
  const decoder = new TextDecoder('utf-16le')
  const cp1252 = new TextDecoder('windows-1252')
  let out = ''
  for (let i = 0; i < n && out.length < ccpText; i++) {
    const cpStart = tv.getUint32(plc + i * 4, true)
    const cpEnd = tv.getUint32(plc + (i + 1) * 4, true)
    const fcRaw = tv.getUint32(plc + (n + 1) * 4 + i * 8 + 2, true)
    const count = Math.min(cpEnd - cpStart, ccpText - out.length)
    if (count <= 0) continue
    const compressed = (fcRaw & 0x40000000) !== 0
    const fc = fcRaw & 0x3fffffff
    out += compressed
      ? cp1252.decode(wd.subarray(fc / 2, fc / 2 + count))
      : decoder.decode(wd.subarray(fc, fc + count * 2))
  }
  return cleanWordChars(out)
}

// 필드 코드(0x13 코드 0x14 결과 0x15)는 결과만 남기고, 표·그림 표시 같은 제어 문자를 정리한다
function cleanWordChars(s: string): string {
  let out = ''
  const stack: ('code' | 'result')[] = []
  for (const ch of s) {
    const c = ch.charCodeAt(0)
    if (c === 0x13) { stack.push('code'); continue }
    if (c === 0x14) { if (stack.length) stack[stack.length - 1] = 'result'; continue }
    if (c === 0x15) { stack.pop(); continue }
    if (stack.includes('code')) continue
    if (c === 0x0d || c === 0x0b || c === 0x0c) out += '\n'
    else if (c === 0x07) out += '\t' // 표 칸 끝
    else if (c === 0x09) out += ' '
    else if (c === 0x1e) out += '-'
    else if (c < 0x20 || c === 0x1f) continue // 그림(0x01)·도형(0x08)·숨은 하이픈 등
    else out += ch
  }
  return out
}

// ───────── .docx: word/document.xml 의 문단(w:p)·글자(w:t) ─────────
function docxText(bytes: Uint8Array): string {
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(bytes, { filter: (f) => f.name === 'word/document.xml' })
  } catch {
    throw new DocExtractError('워드 파일을 열지 못했습니다. 파일이 손상되었을 수 있습니다.')
  }
  const xml = files['word/document.xml']
  if (!xml) throw new DocExtractError('워드 문서 본문을 찾지 못했습니다.')
  const body = strFromU8(xml)
  const paras = body.split(/<\/w:p>/)
  return paras
    .map((para) =>
      para
        .replace(/<w:tab\/>/g, ' ')
        .replace(/<w:br[^>]*\/>/g, '\n')
        .replace(/<w:tc>/g, '\t')
        .match(/<w:t(?:\s[^>]*)?>[^<]*<\/w:t>|\n|\t/g)
        ?.map((t) => (t === '\n' || t === '\t' ? t : t.replace(/<[^>]+>/g, '')))
        .join('') ?? '',
    )
    .map(decodeXml)
    .join('\n')
}

const decodeXml = (s: string) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&amp;/g, '&')

// ───────── .txt: UTF-8, 깨지면 EUC-KR ─────────
function plainText(bytes: Uint8Array): string {
  const utf8 = new TextDecoder('utf-8').decode(bytes)
  if (!utf8.includes('�')) return utf8
  try { return new TextDecoder('euc-kr').decode(bytes) } catch { return utf8 }
}

// 줄 끝 공백, 3줄 이상 빈 줄, 표 칸 구분을 정리
function tidy(s: string): string {
  return s
    .replace(/ /g, ' ')
    .split('\n')
    .map((l) => l.replace(/\t+/g, ' | ').replace(/^\s*\|\s*|\s*\|\s*$/g, '').replace(/[ 　]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// 제목 추측: 앞쪽 줄 중 “보도자료·배포일·담당자·연락처” 같은 머리 줄을 건너뛴 첫 문장다운 줄
export function guessTitle(text: string, fileName: string): string {
  const skip = /^(보도\s*자료|press\s*release|배포|보도\s*일시|보도\s*시점|엠바고|담당|문의|연락|전화|tel|fax|e-?mail|이메일|홍보|www\.|https?:|\d{4}[.\-년]|자료\s*제공|사진|붙임|첨부|총\s*\d+\s*매)/i
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const line = lines.slice(0, 15).find((l) => l.length >= 8 && l.length <= 120 && !skip.test(l) && !/^[\d\s.\-:/()]+$/.test(l))
  return (line ?? fileName.replace(/\.[^.]+$/, '')).slice(0, 200)
}
