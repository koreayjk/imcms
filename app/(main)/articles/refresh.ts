'use server'

import { revalidateTag } from 'next/cache'
import { getCmsContext } from '@/lib/cms'
import { outletTag } from '@/lib/outlet-cache'

// 매체 홈페이지는 1분 동안 같은 데이터를 쓴다 (lib/public-data.ts). 기사를 바꾸면 그 매체 것만 바로 지워 곧바로 보이게 한다
const UUID = /^[0-9a-f-]{36}$/

function refresh(ids: unknown[]) {
  for (const id of new Set(ids.filter((x): x is string => typeof x === 'string' && UUID.test(x)))) revalidateTag(outletTag(id), { expire: 0 })
}

// 기사 저장·발행·승인·되돌리기 뒤: 그 기사 매체 + 함께 송고된 사본이 있는 매체
export async function refreshArticlePages(articleId: string) {
  if (!UUID.test(articleId)) return
  const { supabase } = await getCmsContext()
  const [{ data: a }, { data: copies }] = await Promise.all([
    supabase.from('articles').select('outlet_id').eq('id', articleId).maybeSingle(),
    // syndication.sql 전이면 칸이 없어 조용히 빈 값
    supabase.from('articles').select('outlet_id').eq('source_article_id', articleId),
  ])
  refresh([a?.outlet_id, ...((copies ?? []) as { outlet_id: string | null }[]).map((c) => c.outlet_id)])
}

// 홈 편집판 저장 뒤
export async function refreshOutletPages(outletId: string) {
  await getCmsContext()
  refresh([outletId])
}

// 서버에서 이미 매체를 알 때 (기사 삭제 등)
export async function refreshOutlets(outletIds: (string | null | undefined)[]) {
  await getCmsContext()
  refresh(outletIds)
}
