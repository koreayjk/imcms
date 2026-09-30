import { createHash } from 'crypto'
import type { AiDraft } from '@/lib/ai-draft'
import type { DraftIssue } from '@/lib/ai-check'

// 검토 링크에 담는 비교 결과 (성공한 초안만)
export type ShareDraft = { draft: AiDraft; ms: number; costUsd: number; issues: DraftIssue[] }
export type ShareData = {
  at: string
  releases: { id: string; title: string; source: string; text: string }[]
  models: { id: string; label: string }[]
  results: Record<string, ShareDraft> // `${보도자료ID}|${모델ID}`
}
export type ShareMeta = { models: { id: string; label: string }[]; releases: { id: string; title: string }[] }

export const shareKey = (releaseId: string, modelId: string) => `${releaseId}|${modelId}`
export const SLOTS = ['A', 'B', 'C', 'D', 'E', 'F']

// 블라인드: 보도자료마다 초안 순서를 섞는다. 같은 링크·같은 자료면 항상 같은 순서(검토 제출 때 되돌리기 위해)
export function slotOrder(token: string, releaseId: string, modelIds: string[]) {
  return [...modelIds].sort((a, b) => {
    const h = (m: string) => createHash('sha256').update(`${token}|${releaseId}|${m}`).digest('hex')
    return h(a) < h(b) ? -1 : 1
  })
}
