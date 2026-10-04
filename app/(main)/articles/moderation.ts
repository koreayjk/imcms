'use server'

import { getCmsContext } from '@/lib/cms'
import { htmlToText } from '@/lib/press'
import { moderateArticle, MODERATION_LABEL } from '@/lib/ai-moderation'

export type TrialPublishResult =
  | { ok: true }
  | { ok: false; held: true; note: string }
  | { ok: false; held?: false; error: string }

// 체험신문 발행 (trial-moderation.sql): 금칙어 → AI 순서로 검사하고, 통과하면 확인값을 넣어 발행한다
//   걸리거나 AI가 검사하지 못하면 발행하지 않고 '총관리자 확인'으로 넘긴다
//   기사쓰기의 발행·편집장 승인에서 체험 계정일 때 부른다 (기사는 먼저 승인대기로 저장되어 있어야 한다)
export async function trialPublish(articleId: string, publishedAt: string | null): Promise<TrialPublishResult> {
  const { supabase, user, trial } = await getCmsContext()
  if (!trial) return { ok: false, error: '체험 계정만 쓰는 기능입니다.' }

  const { data: a, error } = await supabase.from('articles').select('*').eq('id', articleId).maybeSingle()
  if (error || !a) return { ok: false, error: '기사를 찾지 못했습니다.' }
  if (a.moderation_hold) return { ok: false, held: true, note: a.moderation_note ?? '총관리자 확인을 기다리고 있습니다.' }

  const hold = async (note: string): Promise<TrialPublishResult> => {
    await supabase.from('articles').update({ status: 'in_review', moderation_hold: true, moderation_note: note }).eq('id', articleId)
    return { ok: false, held: true, note }
  }

  const text = htmlToText(a.body ?? '')
  const all = [a.title, a.excerpt, text, a.byline, (a.tags ?? []).join(','), a.meta_title, a.meta_description].filter(Boolean).join('\n')
  const { data: hits } = await supabase.rpc('trial_word_hits', { txt: all })
  if (Array.isArray(hits) && hits.length) return hold(`금칙어 검사: ${hits.join('·')} 표현`)

  try {
    const m = await moderateArticle({ title: [a.title, a.byline].filter(Boolean).join(' / '), subtitle: a.excerpt ?? '', text: [text, (a.tags ?? []).join(', ')].filter(Boolean).join('\n\n') })
    if (m?.flagged) {
      const kinds = m.kinds.map((k) => MODERATION_LABEL[k]).join('·')
      return hold(`AI 검사${kinds ? `: ${kinds}` : ''}${m.reason ? ` — ${m.reason}` : ''}`)
    }
  } catch {
    return hold('AI 검사를 하지 못했습니다')
  }

  const { data: hash } = await supabase.rpc('trial_content_hash', { a: articleId })
  const { data: after, error: err } = await supabase.from('articles').update({
    status: 'published',
    published_at: publishedAt ?? new Date().toISOString(),
    reviewed_by: user.id,
    reject_reason: null,
    moderation_hash: hash,
  }).eq('id', articleId).select('status, moderation_hold, moderation_note').maybeSingle()
  if (err) return { ok: false, error: err.message }
  // DB가 다시 본 결과 (그사이 내용이 바뀌었으면 보류된다)
  if (after?.moderation_hold) return { ok: false, held: true, note: after.moderation_note ?? '총관리자 확인을 기다리고 있습니다.' }
  return { ok: true }
}
