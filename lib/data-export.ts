// 자료 내보내기·가져오기에 같이 쓰는 형식 (IM 뉴스룸 표준 형식)
//   내보낸 JSON은 다른 회사가 읽기 쉽게 칸 이름을 단순하게 두고, 우리 가져오기 도구도 그대로 읽는다
export const EXPORT_FORMAT = 'imnewsroom-export'
export const EXPORT_VERSION = 1

export type ExportArticle = {
  id: string
  legacy_id: string | null
  url: string | null
  title: string
  excerpt: string | null
  body: string
  section_slug: string | null
  section_name: string | null
  byline: string | null
  status: string
  published_at: string | null
  updated_at: string | null
  tags: string[]
  thumbnail_url: string | null
  view_count: number
  images: string[]
}

// 본문 속 사진 주소 (중복 없이, 나온 순서대로)
export function bodyImages(html: string | null | undefined) {
  const out: string[] = []
  for (const m of (html ?? '').matchAll(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    if (!out.includes(m[1])) out.push(m[1])
  }
  return out
}

// 우리 사진 저장소 주소면 저장소 안 경로 (ZIP 안 파일 이름으로 쓴다)
export function storagePath(url: string) {
  const i = url.indexOf('/storage/v1/object/public/media/')
  if (i < 0) return null
  const p = decodeURIComponent(url.slice(i + '/storage/v1/object/public/media/'.length).split('?')[0])
  return p && !p.includes('..') ? p : null
}

// 엑셀에서 바로 열리는 CSV 칸 (쉼표·따옴표·줄바꿈이 있으면 따옴표로 감싼다)
export function csvCell(v: unknown) {
  const s = v === null || v === undefined ? '' : Array.isArray(v) ? v.join(', ') : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
