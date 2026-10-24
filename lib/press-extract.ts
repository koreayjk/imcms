// 메일로 받은 보도자료 첨부(한글·워드·PDF·텍스트)에서 글자를 뽑는다 (서버 전용, 그림 속 글자 읽기(OCR)는 하지 않는다)
import { extractTextFromBytes } from './doc-extract'

export const MAX_EXTRACT_BYTES = 10 * 1024 * 1024
export const MAX_EXTRACT_CHARS = 20_000

export const isReadableDoc = (name: string) => /\.(pdf|hwp|hwpx|docx?|txt|md|markdown|csv)$/i.test(name)

export type Extracted = { text: string } | { note: string }

async function pdfText(bytes: Uint8Array): Promise<string> {
  const { getDocumentProxy, extractText } = await import('unpdf')
  const pdf = await getDocumentProxy(new Uint8Array(bytes))
  const { text } = await extractText(pdf, { mergePages: true })
  return (Array.isArray(text) ? text.join('\n') : text)
    .split('\n').map((l) => l.replace(/[ \t]+/g, ' ').trim()).join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export async function extractAttachment(name: string, bytes: Uint8Array): Promise<Extracted> {
  if (bytes.length > MAX_EXTRACT_BYTES) return { note: '파일이 커서 내용을 읽지 못했습니다. 내려받아 확인해 주세요.' }
  try {
    const text = /\.pdf$/i.test(name) ? await pdfText(bytes) : extractTextFromBytes(name, bytes)
    if (text.length < 20) return { note: '글자를 읽지 못했습니다. 그림으로만 된 파일일 수 있어 내려받아 확인해 주세요.' }
    return { text: text.length > MAX_EXTRACT_CHARS ? text.slice(0, MAX_EXTRACT_CHARS) + '\n…(이하 생략 — 전체는 첨부파일에서 확인하세요)' : text }
  } catch (e) {
    return { note: e instanceof Error && e.message ? e.message : '파일 내용을 읽지 못했습니다.' }
  }
}
