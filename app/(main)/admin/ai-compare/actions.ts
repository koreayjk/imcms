'use server'

import { getCmsContext } from '@/lib/cms'
import { ensureFullBody, htmlToText, sourceLabel, type PressRelease } from '@/lib/press'
import { AiDraftError, draftWithModel, type AiDraft } from '@/lib/ai-draft'
import { checkDraft, type DraftIssue } from '@/lib/ai-check'
import { shareKey, type ShareData, type ShareMeta } from '@/lib/ai-share'
import { randomBytes } from 'crypto'
import { revalidatePath } from 'next/cache'

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

// ───────── 검토 링크: 비교 결과를 다른 기자에게 보내 검토받기 ─────────
export async function createShare(input: { title: string; blind: boolean; data: ShareData }): Promise<{ token?: string; error?: string }> {
  const { supabase, isStaff } = await getCmsContext()
  if (!isStaff) return { error: '운영팀만 쓸 수 있습니다.' }
  const title = input.title.trim().slice(0, 80) || 'AI 초안 비교'
  const d = input.data
  // 성공한 초안만, 필요한 값만 담는다
  const results: ShareData['results'] = {}
  for (const r of d.releases) {
    for (const m of d.models) {
      const x = d.results[shareKey(r.id, m.id)]
      if (x?.draft) results[shareKey(r.id, m.id)] = { draft: x.draft, ms: x.ms, costUsd: x.costUsd, issues: x.issues ?? [] }
    }
  }
  const releases = d.releases.filter((r) => d.models.some((m) => results[shareKey(r.id, m.id)]))
  if (!releases.length) return { error: '공유할 초안이 없습니다. 비교를 먼저 끝내 주세요.' }
  const data: ShareData = { at: d.at, releases: releases.map((r) => ({ id: r.id, title: r.title, source: r.source, text: r.text })), models: d.models, results }
  const meta: ShareMeta = { models: d.models, releases: releases.map((r) => ({ id: r.id, title: r.title })) }
  const token = randomBytes(18).toString('base64url')
  const { error } = await supabase.from('ai_compare_shares').insert({ token, title, blind: input.blind, data, meta })
  if (error) return { error: /ai_compare_shares/.test(error.message) ? 'DB 준비가 안 됐습니다. supabase/ai-compare-share.sql을 먼저 실행해 주세요.' : error.message }
  revalidatePath('/admin/ai-compare')
  return { token }
}

export async function deleteShare(id: string): Promise<{ error?: string }> {
  const { supabase, isStaff } = await getCmsContext()
  if (!isStaff) return { error: '운영팀만 쓸 수 있습니다.' }
  const { error } = await supabase.from('ai_compare_shares').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/ai-compare')
  return {}
}
