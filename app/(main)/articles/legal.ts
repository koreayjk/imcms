'use server'

import { getCmsContext } from '@/lib/cms'
import { aiReady, AiDraftError } from '@/lib/ai-draft'
import { checkLegal, type LegalCheck } from '@/lib/ai-legal'
import { htmlToText } from '@/lib/press'

// 승인신청·발행 직전에 기사쓰기 화면이 부른다. 검수 횟수는 기자별 AI 사용 기록에 남는다(초안 한도에는 세지 않음)
export async function checkArticleLegal(input: { title: string; subtitle: string; html: string; outletId: string | null }):
  Promise<{ ok: true; check: LegalCheck } | { ok: false; skipped?: boolean; error: string }> {
  const { supabase, outletId } = await getCmsContext()
  if (!aiReady()) return { ok: false, skipped: true, error: 'AI가 설정되지 않아 법적 검수를 건너뜁니다.' }
  const text = htmlToText(input.html)
  if (text.replace(/\s/g, '').length < 30) return { ok: false, skipped: true, error: '본문이 짧아 검수를 건너뜁니다.' }
  try {
    const r = await checkLegal({ title: input.title, subtitle: input.subtitle, text })
    const o = input.outletId ?? outletId
    if (o) await supabase.rpc('ai_usage_log', { o, p_kind: 'legal', m: r.model.id, tin: r.inputTokens, tout: r.outputTokens, cost: Number(r.costUsd.toFixed(5)) })
    return { ok: true, check: r.check }
  } catch (e) {
    return { ok: false, error: e instanceof AiDraftError ? e.message : 'AI 법적 검수를 하지 못했습니다.' }
  }
}
