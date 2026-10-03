'use server'

import { getCmsContext } from '@/lib/cms'
import { aiReady, AiDraftError } from '@/lib/ai-draft'
import { rewriteArticle } from '@/lib/ai-rewrite'
import { finishAi, releaseAi, reserveAi } from '@/lib/ai-usage'
import { rebuild, splitBlocks, textsForRewrite } from '@/lib/rewrite-html'

export type RewriteResult = { ok: true; title: string; excerpt: string | null; body: string } | { ok: false; error: string }

// 함께 송고할 매체용으로 제목·부제·본문 글을 AI로 다시 쓴다. 원본 매체의 AI 사용 1회로 센다
//   바이라인 "[원매체=기자]" 은 받는 매체 이름으로 바꾸고, 사진·영상·표·목록은 그대로 둔다
export async function rewriteForOutlet(input: { sourceOutletId: string | null; sourceOutletName: string | null; outletName: string; title: string; excerpt: string | null; body: string }): Promise<RewriteResult> {
  const { supabase } = await getCmsContext()
  if (!aiReady()) return { ok: false, error: 'AI가 설정되지 않았습니다' }
  const blocks = splitBlocks(input.body ?? '')
  const { byline, texts } = textsForRewrite(blocks)
  if (!texts.length) return { ok: false, error: '바꿀 문단이 없습니다' }

  let slot: Awaited<ReturnType<typeof reserveAi>>
  try {
    slot = await reserveAi(supabase, input.sourceOutletId, 'draft')
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'AI 사용 한도를 확인하지 못했습니다' }
  }
  if (!slot.ok) return { ok: false, error: `이번 달 AI 사용 한도(${slot.limit}회)를 다 썼습니다` }

  try {
    const r = await rewriteArticle({ title: input.title, subtitle: input.excerpt ?? '', paragraphs: texts })
    await finishAi(supabase, slot.id, r)
    const newByline = input.sourceOutletName ? byline.replace(`[${input.sourceOutletName}=`, `[${input.outletName}=`) : byline
    return { ok: true, title: r.out.title, excerpt: input.excerpt ? r.out.subtitle || input.excerpt : null, body: rebuild(blocks, r.out.paragraphs, newByline) }
  } catch (e) {
    await releaseAi(supabase, slot.id)
    return { ok: false, error: e instanceof AiDraftError ? e.message : 'AI로 바꾸지 못했습니다' }
  }
}
