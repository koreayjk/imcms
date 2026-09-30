'use server'

import { getCmsContext } from '@/lib/cms'
import { ensureFullBody, htmlToText, sourceLabel, type PressRelease } from '@/lib/press'
import { AiDraftError, draftWithModel, type AiDraft } from '@/lib/ai-draft'
import { checkDraft, type DraftIssue } from '@/lib/ai-check'

export type CompareRelease = { id: string; title: string; source: string; text: string }
export type CompareResult =
  | { ok: true; draft: AiDraft; ms: number; inputTokens: number; outputTokens: number; costUsd: number; issues: DraftIssue[] }
  | { ok: false; error: string }

// 최근 보도자료 10건 (전문을 가져올 수 있는 것만)
export async function prepareReleases(count = 10): Promise<{ releases?: CompareRelease[]; error?: string }> {
  const { supabase, isStaff } = await getCmsContext()
  if (!isStaff) return { error: '운영팀만 쓸 수 있습니다.' }
  const { data, error } = await supabase.from('press_releases').select('*').order('published_at', { ascending: false, nullsFirst: false }).limit(30)
  if (error) return { error: error.message }
  const out: CompareRelease[] = []
  for (const row of (data ?? []) as PressRelease[]) {
    if (out.length >= count) break
    const r = await ensureFullBody(supabase, row)
    const text = htmlToText(r.body_html ?? '')
    if (text.length < 300) continue // 요약만 있는 자료는 비교에서 뺀다
    out.push({ id: r.id, title: r.title, source: sourceLabel(r), text: text.slice(0, 12000) })
  }
  return { releases: out }
}

export async function runDraft(modelId: string, release: CompareRelease): Promise<CompareResult> {
  const { isStaff } = await getCmsContext()
  if (!isStaff) return { ok: false, error: '운영팀만 쓸 수 있습니다.' }
  try {
    const r = await draftWithModel(modelId, { title: release.title, text: release.text, source: release.source })
    return { ok: true, draft: r.draft, ms: r.ms, inputTokens: r.inputTokens, outputTokens: r.outputTokens, costUsd: r.costUsd, issues: checkDraft(release.text, r.draft) }
  } catch (e) {
    return { ok: false, error: e instanceof AiDraftError ? e.message : e instanceof Error ? e.message : '알 수 없는 오류' }
  }
}
