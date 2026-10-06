'use server'

import { getCmsContext } from '@/lib/cms'
import { shareToken } from '@/lib/article-share'
import { siteOrigin } from '@/lib/origin'

export type ArticleLink = { ok: true; url: string; live: boolean } | { ok: false; error: string }

// 기사 링크: 홈페이지에 공개된 기사는 실제 기사 주소, 아직이면(작성중·승인대기·예약) 미리보기 링크
export async function articleLink(id: string): Promise<ArticleLink> {
  const { supabase } = await getCmsContext()
  // 볼 수 있는 기사인지는 DB 규칙이 확인한다
  const { data: a } = await supabase.from('articles').select('id, status, published_at, outlet:outlets(domain)').eq('id', id).maybeSingle()
  if (!a) return { ok: false, error: '기사를 찾을 수 없습니다. 먼저 저장해 주세요.' }
  const domain = (a.outlet as unknown as { domain: string | null } | null)?.domain
  const base = domain ? `https://${domain.replace(/^https?:\/\//, '')}` : (await siteOrigin())
  const live = a.status === 'published' && (!a.published_at || Date.parse(a.published_at) <= Date.now())
  if (live) return { ok: true, url: `${base}/news/${a.id}`, live: true }
  if (!process.env.PAYMENT_DB_SECRET) return { ok: false, error: '미리보기 링크를 쓰려면 관리자가 서버 열쇠(PAYMENT_DB_SECRET)를 설정해야 합니다.' }
  return { ok: true, url: `${base}/p/${a.id}?k=${shareToken(a.id)}`, live: false }
}
