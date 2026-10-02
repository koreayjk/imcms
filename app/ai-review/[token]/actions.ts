'use server'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { SLOTS, slotOrder } from '@/lib/ai-share'
import { loadShare } from './data'

export type ReviewReveal = Record<string, Record<string, string>> // 보도자료ID → { A: 모델 이름 }

export async function submitReview(
  token: string,
  input: { reviewer: string; picks: Record<string, string>; notes: Record<string, string>; comment: string },
): Promise<{ ok?: true; reveal?: ReviewReveal; error?: string }> {
  const reviewer = input.reviewer.trim().slice(0, 40)
  if (!reviewer) return { error: '이름을 적어 주세요.' }
  if (input.comment.trim().length < 10) return { error: '전체 의견을 10자 이상 적어 주세요.' }
  const share = await loadShare(token)
  if (!share) return { error: '링크가 없거나 기한이 지났습니다.' }
  const { releases, models } = share.data
  const label = (id: string) => models.find((m) => m.id === id)?.label ?? id

  // 화면의 A·B·C를 실제 모델로 되돌린다
  const picks: Record<string, string> = {}
  const notes: Record<string, string> = {}
  const reveal: ReviewReveal = {}
  for (const r of releases) {
    const order = share.blind ? slotOrder(token, r.id, models.map((m) => m.id)) : models.map((m) => m.id)
    reveal[r.id] = Object.fromEntries(order.map((m, i) => [SLOTS[i], label(m)]))
    const slot = input.picks[r.id]
    const i = slot ? SLOTS.indexOf(slot) : -1
    if (i >= 0 && order[i]) picks[r.id] = order[i]
    const note = (input.notes[r.id] ?? '').trim().slice(0, 500)
    if (note) notes[r.id] = note
  }
  // 자료마다 초안 선택과 한 줄 의견(5자 이상)이 모두 있어야 한다
  const missing = releases.filter((r) => !picks[r.id] || (notes[r.id] ?? '').length < 5).length
  if (missing) return { error: `아직 ${missing}건이 남았습니다. 자료마다 초안 하나를 고르고 한 줄 의견(5자 이상)을 적어 주세요.` }

  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.rpc('ai_compare_review_submit', {
    p_token: token, p_reviewer: reviewer, p_picks: picks, p_notes: notes, p_comment: input.comment.trim().slice(0, 2000),
  })
  if (error) return { error: error.message }
  return { ok: true, reveal: share.blind ? reveal : undefined }
}
