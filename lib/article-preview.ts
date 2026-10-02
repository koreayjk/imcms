// 기사쓰기 → 미리보기 창으로 넘기는 내용 (같은 탭의 sessionStorage로 전한다)
export const PREVIEW_STORE = 'im-article-preview'

export type ArticlePreviewData = {
  title: string
  subtitle: string
  html: string
  category: { name: string; slug: string } | null
  author: string
  email: string | null
  publishedAt: string
  tags: string[]
  thumbnail: string | null
}
