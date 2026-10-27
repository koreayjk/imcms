'use server'

import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import { aiReady, AiDraftError } from '@/lib/ai-draft'
import { rewriteArticle } from '@/lib/ai-rewrite'
import { finishAi, releaseAi, reserveAi } from '@/lib/ai-usage'
import { rebuild, splitBlocks, textsForRewrite } from '@/lib/rewrite-html'

export type RewriteResult = { ok: true; title: string; excerpt: string | null; body: string } | { ok: false; error: string }

// 함께 송고할 매체용으로 제목·부제·본문 글을 AI로 다시 쓴다. 원본 매체의 AI 사용 1회로 센다
//   바이라인 "[원매체=기자]" 은 받는 매체 이름으로 바꾸고, 사진·영상·표·목록은 그대로 둔다
export async function rewriteForOutlet(input: { sourceOutletId: string | null; sourceOutletName: string | null; outletName: string; title: string; excerpt: string | null; body: string }): Promise<RewriteResult> {
  const { supabase } = await getCmsContext()
  const { t } = await getT()
  if (!aiReady()) return { ok: false, error: t('AI가 설정되지 않았습니다', 'AI is not configured') }
  const blocks = splitBlocks(input.body ?? '')
  const { byline, texts } = textsForRewrite(blocks)
  if (!texts.length) return { ok: false, error: t('바꿀 문단이 없습니다', 'There are no paragraphs to rewrite') }

  let slot: Awaited<ReturnType<typeof reserveAi>>
  try {
    slot = await reserveAi(supabase, input.sourceOutletId, 'draft')
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : t('AI 사용 한도를 확인하지 못했습니다', 'Could not check the AI usage limit') }
  }
  if (!slot.ok) return { ok: false, error: t(`이번 달 AI 사용 한도(${slot.limit}회)를 다 썼습니다`, `The AI usage limit for this month (${slot.limit} uses) has been reached`) }

  try {
    const r = await rewriteArticle({ title: input.title, subtitle: input.excerpt ?? '', paragraphs: texts })
    await finishAi(supabase, slot.id, r)
    const newByline = input.sourceOutletName ? byline.replace(`[${input.sourceOutletName}=`, `[${input.outletName}=`) : byline
    return { ok: true, title: r.out.title, excerpt: input.excerpt ? r.out.subtitle || input.excerpt : null, body: rebuild(blocks, r.out.paragraphs, newByline) }
  } catch (e) {
    await releaseAi(supabase, slot.id)
    return { ok: false, error: e instanceof AiDraftError ? e.message : t('AI로 바꾸지 못했습니다', 'AI could not rewrite the story') }
  }
}
