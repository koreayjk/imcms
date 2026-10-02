'use server'

import { getCmsContext } from '@/lib/cms'
import { createHmac } from 'crypto'
import { AiDraftError } from '@/lib/ai-draft'
import { checkLegal, legalModel, type LegalCheck } from '@/lib/ai-legal'
import { htmlToText } from '@/lib/press'

// 띄어쓰기·줄바꿈만 다른 경우는 같은 글로 본다. 서버 비밀값으로 서명해 두어, 검수 결과를 직접 만들어 저장해도 "검수 완료"로 통하지 않게 한다
function contentHash(title: string, subtitle: string, text: string) {
  const norm = (v: string) => v.replace(/\s+/g, ' ').trim()
  return createHmac('sha256', `legal:${process.env.PAYMENT_DB_SECRET ?? ''}`).update([title, subtitle, text].map(norm).join('\u0000')).digest('hex').slice(0, 32)
}

// 승인신청·발행 직전에 기사쓰기 화면이 부른다. 검수 횟수는 기자별 AI 사용 기록에 남는다(초안 한도에는 세지 않음)
// articleId가 있으면 저장된 검수 결과와 글자를 비교해, 같으면 AI를 다시 부르지 않는다 (기자가 승인신청 때 검수한 기사를 편집장이 그대로 발행하는 경우 등)
export async function checkArticleLegal(input: { title: string; subtitle: string; html: string; outletId: string | null; articleId?: string | null }):
  Promise<{ ok: true; check: LegalCheck } | { ok: false; skipped?: boolean; error: string }> {
  const { supabase, outletId } = await getCmsContext()
  if (!legalModel()) return { ok: false, skipped: true, error: 'AI가 설정되지 않아 법적 검수를 건너뜁니다.' }
  const text = htmlToText(input.html)
  if (text.replace(/\s/g, '').length < 30) return { ok: false, skipped: true, error: '본문이 짧아 검수를 건너뜁니다.' }
  const hash = contentHash(input.title, input.subtitle, text)
  if (input.articleId) {
    // newsroom-settings.sql 실행 전이면 칸이 없어 오류가 나므로 그냥 새로 검수한다
    const { data } = await supabase.from('articles').select('legal_check').eq('id', input.articleId).maybeSingle()
    const saved = (data as { legal_check?: LegalCheck | null } | null)?.legal_check
    if (saved?.content_hash === hash) return { ok: true, check: { ...saved, reused: true } }
  }
  try {
    const r = await checkLegal({ title: input.title, subtitle: input.subtitle, text })
    const o = input.outletId ?? outletId
    if (o) await supabase.rpc('ai_usage_log', { o, p_kind: 'legal', m: r.model.id, tin: r.inputTokens, tout: r.outputTokens, cost: Number(r.costUsd.toFixed(5)) })
    return { ok: true, check: { ...r.check, content_hash: hash } }
  } catch (e) {
    return { ok: false, error: e instanceof AiDraftError ? e.message : 'AI 법적 검수를 하지 못했습니다.' }
  }
}
