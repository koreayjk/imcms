export type UserRole = 'reporter' | 'editor' | 'admin'
export type ArticleStatus = 'draft' | 'in_review' | 'published' | 'rejected'

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  outlet_id: string | null
  created_at: string
  // signup.sql 실행 전에는 칸이 없다 (없으면 승인된 것으로 본다)
  approved?: boolean
  // groups.sql: 총관리자 표시, 발행인의 그룹
  is_super?: boolean
  is_staff?: boolean
  publisher_id?: string | null
}

export interface Outlet {
  id: string
  name: string
  domain: string | null
  created_at: string
}

export interface Category {
  id: string
  outlet_id: string | null
  name: string
  slug: string
  sort_order: number
}

export interface Article {
  id: string
  outlet_id: string | null
  category_id: string | null
  author_id: string
  title: string
  body: string
  excerpt: string | null
  thumbnail_url: string | null
  status: ArticleStatus
  reviewed_by: string | null
  reject_reason: string | null
  published_at: string | null
  scheduled_at: string | null
  created_at: string
  updated_at: string
  tags: string[] | null
  meta_title: string | null
  meta_description: string | null
  view_count: number
  is_featured: boolean
  source_article_id?: string | null
  syndicate_to?: string[]
  press_release_id?: string | null
  // article-manage.sql 실행 전에는 칸이 없다
  byline?: string | null
  ai_notes?: string | null
  author?: Pick<Profile, 'id' | 'full_name' | 'role'>
  category?: Pick<Category, 'id' | 'name' | 'slug'>
  outlet?: Pick<Outlet, 'id' | 'name'>
}

export const STATUS_LABEL: Record<ArticleStatus, string> = {
  draft: '작성중',
  in_review: '승인신청',
  published: '발행',
  rejected: '반려',
}

export const ROLE_LABEL: Record<UserRole, string> = {
  reporter: '기자',
  editor: '편집장',
  admin: '발행인',
}
