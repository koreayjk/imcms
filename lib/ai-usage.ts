import type { SupabaseClient } from '@supabase/supabase-js'
import { EXTRA_AI_FEE } from './pricing'

// 매체별 이번 달 AI 기사 초안 사용량 (supabase/ai-usage.sql)
//   SQL 실행 전이면 함수가 없어서 한도 없이 쓰고 집계도 하지 않는다
export type AiStatus = { plan: string | null; limit: number | null; used: number; overage: boolean; over: number }

export async function getAiStatus(supabase: SupabaseClient, outletId: string | null): Promise<AiStatus | null> {
  if (!outletId) return null
  const { data, error } = await supabase.rpc('ai_usage_status', { o: outletId })
  if (error || !data) return null
  return data as AiStatus
}

export type AiReserve = { ok: true; id: number | null; used?: number; limit?: number | null; overLimit?: boolean } | { ok: false; used: number; limit: number }

// AI 초안을 쓰기 직전에 한 건을 잡는다 (한도를 다 썼고 추가 사용이 꺼져 있으면 ok:false)
export async function reserveAi(supabase: SupabaseClient, outletId: string | null): Promise<AiReserve> {
  if (!outletId) return { ok: true, id: null }
  const { data, error } = await supabase.rpc('ai_usage_reserve', { o: outletId })
  if (error) {
    // 함수가 없으면(SQL 실행 전) 집계 없이 쓴다. 권한 오류 등은 그대로 알린다
    if (/ai_usage_reserve|schema cache|does not exist/i.test(error.message)) return { ok: true, id: null }
    throw new Error(error.message)
  }
  const d = data as { ok: boolean; id?: number; used: number; limit: number | null; over_limit?: boolean }
  return d.ok ? { ok: true, id: d.id ?? null, used: d.used, limit: d.limit, overLimit: d.over_limit } : { ok: false, used: d.used, limit: d.limit as number }
}

export async function finishAi(supabase: SupabaseClient, id: number | null, r: { model: { id: string }; inputTokens: number; outputTokens: number; costUsd: number }) {
  if (id == null) return
  await supabase.rpc('ai_usage_finish', { rid: id, m: r.model.id, tin: r.inputTokens, tout: r.outputTokens, cost: Number(r.costUsd.toFixed(5)) })
}

export async function releaseAi(supabase: SupabaseClient, id: number | null) {
  if (id == null) return
  await supabase.rpc('ai_usage_release', { rid: id })
}

// 한도에 가까워졌는지·넘었는지 (화면 알림용). 한도가 없으면 null
export function aiLevel(s: AiStatus | null): 'ok' | 'near' | 'full' | 'over' | null {
  if (!s || s.limit == null) return null
  if (s.used > s.limit) return 'over'
  if (s.used >= s.limit) return 'full'
  if (s.used >= s.limit * 0.8) return 'near'
  return 'ok'
}

export function aiLimitMessage(s: Pick<AiStatus, 'used' | 'limit' | 'overage'> & { over?: number }) {
  if (s.limit == null) return ''
  if (s.used >= s.limit) {
    return s.overage
      ? `이번 달 AI 초안 한도(${s.limit.toLocaleString()}건)를 넘어 추가 사용 중입니다${s.over ? ` (${s.over.toLocaleString()}건)` : ''}. 추가분은 100건마다 ${EXTRA_AI_FEE.toLocaleString()}원이 청구됩니다.`
      : `이번 달 AI 초안 한도(${s.limit.toLocaleString()}건)를 다 썼습니다. 다음 달 1일에 다시 쓸 수 있고, 더 쓰려면 고객센터에서 “추가 사용”을 신청하세요. 원문 그대로 기사 만들기는 계속 쓸 수 있습니다.`
  }
  const left = s.limit - s.used
  return `이번 달 AI 초안 ${s.used.toLocaleString()}/${s.limit.toLocaleString()}건 사용 · ${left.toLocaleString()}건 남음`
}
