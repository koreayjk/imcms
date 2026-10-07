'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { describe, syndicate } from '@/lib/syndicate'
import { notifyArticle } from '@/app/(main)/articles/notify'
import { refreshArticlePages } from '@/app/(main)/articles/refresh'
import { trialPublish } from '@/app/(main)/articles/moderation'

// 기사목록에서 승인신청 기사를 골라 한꺼번에 승인·발행하거나 반려한다 (편집장·발행인·총관리자)
//   한 건씩 처리하는 것(ReviewActions)과 똑같이: 정해 둔 발행 일시 지키기 · 함께 송고 · 기자 알림 · 홈페이지 바로 반영
export type BulkItem = { id: string; title: string; publishedAt: string | null; hasSection: boolean }

type Ctx = { selected: Set<string>; toggle: (id: string) => void; items: BulkItem[] }
const BulkCtx = createContext<Ctx | null>(null)

export function BulkReview({ items, moderated = false, children }: { items: BulkItem[]; moderated?: boolean; children: ReactNode }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const router = useRouter()

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const all = items.length > 0 && items.every((i) => selected.has(i.id))
  const some = !all && items.some((i) => selected.has(i.id))
  const picked = items.filter((i) => selected.has(i.id))

  async function approve() {
    const noSection = picked.filter((i) => !i.hasSection)
    const ok = picked.filter((i) => i.hasSection)
    if (!ok.length) { window.alert('섹션이 정해지지 않은 기사는 발행할 수 없습니다. 수정 화면에서 섹션을 고른 뒤 승인해 주세요.'); return }
    const later = ok.filter((i) => i.publishedAt && Date.parse(i.publishedAt) > Date.now()).length
    const msg = [
      `선택한 기사 ${ok.length}건을 승인하고 발행할까요?`,
      later ? `그중 ${later}건은 기자가 정한 발행 일시로 예약 발행됩니다.` : '',
      noSection.length ? `섹션이 없는 ${noSection.length}건은 빼고 처리합니다.` : '',
    ].filter(Boolean).join('\n')
    if (!window.confirm(msg)) return

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const done: string[] = []
    const failed: string[] = []
    const notes: string[] = []
    for (const [n, a] of ok.entries()) {
      setBusy(`승인 중 ${n + 1}/${ok.length}`)
      if (moderated) {
        const r = await trialPublish(a.id, a.publishedAt).catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : '오류' }))
        if (!r.ok) { failed.push(`“${a.title}”: ${'held' in r && r.held ? `총관리자 확인 대기 (${r.note})` : 'error' in r ? r.error : ''}`); continue }
      } else {
        const { data, error } = await supabase.from('articles').update({
          status: 'published',
          published_at: a.publishedAt ?? new Date().toISOString(),
          reviewed_by: user?.id ?? null,
          reject_reason: null,
        }).eq('id', a.id).eq('status', 'in_review').select('id')
        if (error || !data?.length) { failed.push(`“${a.title}”: ${error?.message ?? '이미 처리된 기사입니다'}`); continue }
      }
      done.push(a.id)
      notifyArticle(a.id, 'published').catch(() => {})
      try {
        const s = describe(await syndicate(a.id))
        if (s) notes.push(`“${a.title}”\n${s}`)
      } catch (e) {
        notes.push(`“${a.title}”: 함께 송고 중 문제 (${e instanceof Error ? e.message : ''})`)
      }
      await refreshArticlePages(a.id).catch(() => {})
    }
    finish(`${done.length}건을 승인·발행했습니다.`, failed, notes)
  }

  async function reject() {
    const why = reason.trim()
    if (!why) return
    const supabase = createClient()
    const failed: string[] = []
    let done = 0
    for (const [n, a] of picked.entries()) {
      setBusy(`반려 중 ${n + 1}/${picked.length}`)
      const { data, error } = await supabase.from('articles').update({ status: 'rejected', reject_reason: why }).eq('id', a.id).eq('status', 'in_review').select('id')
      if (error || !data?.length) { failed.push(`“${a.title}”: ${error?.message ?? '이미 처리된 기사입니다'}`); continue }
      done++
      notifyArticle(a.id, 'rejected').catch(() => {})
    }
    setRejecting(false)
    setReason('')
    finish(`${done}건을 반려했습니다. 기자에게 반려 사유가 전달됩니다.`, failed, [])
  }

  function finish(head: string, failed: string[], notes: string[]) {
    setBusy(null)
    setSelected(new Set())
    router.refresh()
    window.alert([head, failed.length ? `\n처리하지 못한 기사 ${failed.length}건:\n${failed.join('\n')}` : '', notes.length ? `\n${notes.join('\n\n')}` : ''].filter(Boolean).join('\n'))
  }

  return (
    <BulkCtx.Provider value={{ selected, toggle, items }}>
      {items.length > 0 && (
        <div className="flex items-center gap-3 border-b border-line bg-review/5 px-4 py-2.5 text-[13px] md:px-5">
          <label className="flex shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap font-semibold">
            <input
              type="checkbox"
              checked={all}
              ref={(el) => { if (el) el.indeterminate = some }}
              onChange={() => setSelected(all ? new Set() : new Set(items.map((i) => i.id)))}
              className="h-4 w-4 accent-review"
            />
            전체 선택
          </label>
          <span className="min-w-0 text-muted">승인신청 {items.length}건<span className="hidden sm:inline">을 골라 한꺼번에 승인·반려할 수 있습니다</span></span>
        </div>
      )}
      {children}
      {picked.length > 0 && <div className="h-16" aria-hidden />}
      {picked.length > 0 && (
        <div className="cms-actionbar border-t border-line bg-white/95 backdrop-blur" role="region" aria-label="선택한 기사 처리">
          <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-2 px-4 py-2.5 md:px-8 md:py-3">
            {rejecting ? (
              <>
                <label htmlFor="bulk-reason" className="sr-only">반려 사유</label>
                <input
                  id="bulk-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && reject()}
                  placeholder={`${picked.length}건 모두에게 보낼 반려 사유`}
                  maxLength={500}
                  autoFocus
                  className="field-input h-10 min-w-0 flex-1"
                />
                <button type="button" onClick={reject} disabled={!reason.trim() || !!busy} className="btn-danger whitespace-nowrap">{busy ?? '반려 확정'}</button>
                <button type="button" onClick={() => { setRejecting(false); setReason('') }} disabled={!!busy} className="whitespace-nowrap text-[13px] text-muted hover:text-ink">취소</button>
              </>
            ) : (
              <>
                <span className="mr-auto text-[13.5px]"><strong className="tabular-nums">{picked.length}</strong>건 선택</span>
                <button type="button" onClick={() => setSelected(new Set())} disabled={!!busy} className="whitespace-nowrap text-[13px] text-muted hover:text-ink">선택 해제</button>
                <button type="button" onClick={() => setRejecting(true)} disabled={!!busy} className="whitespace-nowrap rounded border border-danger/40 px-4 py-2 text-sm text-danger hover:bg-danger/5">일괄 반려</button>
                <button type="button" onClick={approve} disabled={!!busy} className="btn-publish whitespace-nowrap">{busy ?? '일괄 승인·발행'}</button>
              </>
            )}
          </div>
        </div>
      )}
    </BulkCtx.Provider>
  )
}

// 줄마다 붙는 고르기 칸 (승인신청 기사만)
export function BulkCheck({ id, title }: { id: string; title: string }) {
  const ctx = useContext(BulkCtx)
  if (!ctx || !ctx.items.some((i) => i.id === id)) return null
  return (
    <input
      type="checkbox"
      checked={ctx.selected.has(id)}
      onChange={() => ctx.toggle(id)}
      aria-label={`“${title}” 고르기`}
      className="h-4 w-4 shrink-0 cursor-pointer accent-review"
    />
  )
}
