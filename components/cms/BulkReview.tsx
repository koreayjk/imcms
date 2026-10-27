'use client'

import { createContext, useContext, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { describe, syndicate } from '@/lib/syndicate'
import { notifyArticle } from '@/app/(main)/articles/notify'
import { refreshArticlePages } from '@/app/(main)/articles/refresh'
import { trialPublish } from '@/app/(main)/articles/moderation'
import { deleteArticles } from '@/app/(main)/articles/actions'
import { useT } from './CmsLang'

// 기사목록에서 기사를 골라 한꺼번에 처리한다
//   승인·발행 / 반려: 편집장·발행인·총관리자, 고른 것 중 '승인신청' 기사만
//     (한 건씩 처리하는 것(ReviewActions)과 똑같이: 정해 둔 발행 일시 지키기 · 함께 송고 · 기자 알림 · 홈페이지 바로 반영)
//   삭제: 본인 기사 또는 편집장 이상
export type BulkItem = { id: string; title: string; status: string; publishedAt: string | null; hasSection: boolean; canDelete: boolean }

type Ctx = { selected: Set<string>; toggle: (id: string) => void; items: BulkItem[] }
const BulkCtx = createContext<Ctx | null>(null)

export function BulkReview({ items, canReview = false, moderated = false, children }: { items: BulkItem[]; canReview?: boolean; moderated?: boolean; children: ReactNode }) {
  const t = useT()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const router = useRouter()

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const all = items.length > 0 && items.every((i) => selected.has(i.id))
  const some = !all && items.some((i) => selected.has(i.id))
  const picked = items.filter((i) => selected.has(i.id))
  const reviewable = picked.filter((i) => i.status === 'in_review')
  const deletable = picked.filter((i) => i.canDelete)
  const skipped = (n: number, what: 'publish') => (n ? t(`\n승인신청 상태가 아닌 ${n}건은 ${what === 'publish' ? '발행' : ''}하지 않고 그대로 둡니다.`, `\n${n} ${n === 1 ? 'story' : 'stories'} not in “In review” status will be left as is and not ${what === 'publish' ? 'published' : ''}.`) : '')

  async function approve() {
    if (!reviewable.length) { window.alert(t('고른 기사 중 승인신청 기사가 없습니다. 승인·반려는 승인신청 기사만 할 수 있습니다.', 'None of the selected stories are in review. Only stories in review can be approved or rejected.')); return }
    const noSection = reviewable.filter((i) => !i.hasSection)
    const ok = reviewable.filter((i) => i.hasSection)
    if (!ok.length) { window.alert(t('섹션이 정해지지 않은 기사는 발행할 수 없습니다. 수정 화면에서 섹션을 고른 뒤 승인해 주세요.', 'Stories without a section cannot be published. Choose a section on the edit screen, then approve.')); return }
    const later = ok.filter((i) => i.publishedAt && Date.parse(i.publishedAt) > Date.now()).length
    const msg = [
      t(`선택한 기사 ${ok.length}건을 승인하고 발행할까요?`, `Approve and publish the ${ok.length} selected ${ok.length === 1 ? 'story' : 'stories'}?`),
      later ? t(`그중 ${later}건은 기자가 정한 발행 일시로 예약 발행됩니다.`, `${later} of them will be scheduled for the publish time the reporter set.`) : '',
      noSection.length ? t(`섹션이 없는 ${noSection.length}건은 빼고 처리합니다.`, `${noSection.length} without a section will be skipped.`) : '',
    ].filter(Boolean).join('\n') + skipped(picked.length - reviewable.length, 'publish')
    if (!window.confirm(msg)) return

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const done: string[] = []
    const failed: string[] = []
    const notes: string[] = []
    for (const [n, a] of ok.entries()) {
      setBusy(t(`승인 중 ${n + 1}/${ok.length}`, `Approving ${n + 1}/${ok.length}`))
      if (moderated) {
        const r = await trialPublish(a.id, a.publishedAt).catch((e) => ({ ok: false as const, error: e instanceof Error ? e.message : t('오류', 'Error') }))
        if (!r.ok) { failed.push(`“${a.title}”: ${'held' in r && r.held ? t(`총관리자 확인 대기 (${r.note})`, `Waiting for Super Admin review (${r.note})`) : 'error' in r ? r.error : ''}`); continue }
      } else {
        const { data, error } = await supabase.from('articles').update({
          status: 'published',
          published_at: a.publishedAt ?? new Date().toISOString(),
          reviewed_by: user?.id ?? null,
          reject_reason: null,
        }).eq('id', a.id).eq('status', 'in_review').select('id')
        if (error || !data?.length) { failed.push(`“${a.title}”: ${error?.message ?? t('이미 처리된 기사입니다', 'This story has already been handled')}`); continue }
      }
      done.push(a.id)
      try {
        const s = describe(await syndicate(a.id))
        if (s) notes.push(`“${a.title}”\n${s}`)
      } catch (e) {
        notes.push(`“${a.title}”: ${t('함께 송고 중 문제', 'Problem sending to other outlets')} (${e instanceof Error ? e.message : ''})`)
      }
      await refreshArticlePages(a.id).catch(() => {})
    }
    finish(t(`${done.length}건을 승인·발행했습니다.`, `Approved and published ${done.length} ${done.length === 1 ? 'story' : 'stories'}.`), failed, notes)
  }

  async function reject() {
    const why = reason.trim()
    if (!why) return
    const supabase = createClient()
    const failed: string[] = []
    let done = 0
    for (const [n, a] of reviewable.entries()) {
      setBusy(t(`반려 중 ${n + 1}/${reviewable.length}`, `Rejecting ${n + 1}/${reviewable.length}`))
      const { data, error } = await supabase.from('articles').update({ status: 'rejected', reject_reason: why }).eq('id', a.id).eq('status', 'in_review').select('id')
      if (error || !data?.length) { failed.push(`“${a.title}”: ${error?.message ?? t('이미 처리된 기사입니다', 'This story has already been handled')}`); continue }
      done++
      notifyArticle(a.id, 'rejected').catch(() => {})
    }
    setRejecting(false)
    setReason('')
    finish(t(`${done}건을 반려했습니다. 기자에게 반려 사유가 전달됩니다.`, `Rejected ${done} ${done === 1 ? 'story' : 'stories'}. The reporters will receive the rejection reason.`), failed, [])
  }

  function startReject() {
    if (!reviewable.length) { window.alert(t('고른 기사 중 승인신청 기사가 없습니다. 반려는 승인신청 기사만 할 수 있습니다.', 'None of the selected stories are in review. Only stories in review can be rejected.')); return }
    setRejecting(true)
  }

  async function remove() {
    if (!deletable.length) { window.alert(t('지울 수 있는 기사가 없습니다. 본인이 쓴 기사만 지울 수 있습니다.', 'There are no stories you can delete. You can only delete stories you wrote.')); return }
    const live = deletable.filter((i) => i.status === 'published').length
    const msg = [
      t(`선택한 기사 ${deletable.length}건을 삭제할까요?`, `Delete the ${deletable.length} selected ${deletable.length === 1 ? 'story' : 'stories'}?`),
      live ? t(`발행된 ${live}건은 홈페이지에서도 바로 내려가고, 함께 송고된 다른 매체 사본도 삭제됩니다.`, `${live} published ${live === 1 ? 'story' : 'stories'} will be taken down from the site immediately, and copies sent to other outlets will be deleted too.`) : '',
      picked.length > deletable.length ? t(`남이 쓴 ${picked.length - deletable.length}건은 지우지 않습니다.`, `${picked.length - deletable.length} written by others will not be deleted.`) : '',
      t('삭제하면 되돌릴 수 없습니다.', 'This cannot be undone.'),
    ].filter(Boolean).join('\n')
    if (!window.confirm(msg)) return
    setBusy(t(`삭제 중 (${deletable.length}건)`, `Deleting (${deletable.length})`))
    const r = await deleteArticles(deletable.map((i) => i.id)).catch((e) => ({ deleted: 0, failed: [e instanceof Error ? e.message : t('오류', 'Error')] }))
    finish(t(`${r.deleted}건을 삭제했습니다.`, `Deleted ${r.deleted} ${r.deleted === 1 ? 'story' : 'stories'}.`), r.failed, [])
  }

  function finish(head: string, failed: string[], notes: string[]) {
    setBusy(null)
    setSelected(new Set())
    router.refresh()
    window.alert([head, failed.length ? t(`\n처리하지 못한 기사 ${failed.length}건:\n${failed.join('\n')}`, `\n${failed.length} ${failed.length === 1 ? 'story' : 'stories'} could not be processed:\n${failed.join('\n')}`) : '', notes.length ? `\n${notes.join('\n\n')}` : ''].filter(Boolean).join('\n'))
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
            {t('전체 선택', 'Select all')}
          </label>
          <span className="min-w-0 text-muted">{canReview ? <>{t('기사를 골라 한꺼번에 승인·반려·삭제', 'Select stories to approve, reject or delete in bulk')}<span className="hidden sm:inline">{t('할 수 있습니다 (승인·반려는 승인신청 기사만)', ' (approve and reject apply to stories in review only)')}</span></> : <>{t('기사를 골라 한꺼번에 삭제', 'Select stories to delete in bulk')}<span className="hidden sm:inline">{t('할 수 있습니다', '')}</span></>}</span>
        </div>
      )}
      {children}
      {picked.length > 0 && <div className="h-16" aria-hidden />}
      {picked.length > 0 && (
        <div className="cms-actionbar border-t border-line bg-white/95 backdrop-blur" role="region" aria-label={t('선택한 기사 처리', 'Process selected stories')}>
          <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-2 px-4 py-2.5 md:px-8 md:py-3">
            {rejecting ? (
              <>
                <label htmlFor="bulk-reason" className="sr-only">{t('반려 사유', 'Rejection reason')}</label>
                <input
                  id="bulk-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && reject()}
                  placeholder={t(`승인신청 ${reviewable.length}건에 보낼 반려 사유`, `Rejection reason to send for ${reviewable.length} ${reviewable.length === 1 ? 'story' : 'stories'} in review`)}
                  maxLength={500}
                  autoFocus
                  className="field-input h-10 min-w-0 flex-1"
                />
                <button type="button" onClick={reject} disabled={!reason.trim() || !!busy} className="btn-danger whitespace-nowrap">{busy ?? t('반려 확정', 'Confirm rejection')}</button>
                <button type="button" onClick={() => { setRejecting(false); setReason('') }} disabled={!!busy} className="whitespace-nowrap text-[13px] text-muted hover:text-ink">{t('취소', 'Cancel')}</button>
              </>
            ) : (
              <>
                <span className="mr-auto text-[13.5px]"><strong className="tabular-nums">{picked.length}</strong>{t('건 선택', ' selected')}</span>
                <button type="button" onClick={() => setSelected(new Set())} disabled={!!busy} className="hidden whitespace-nowrap text-[13px] text-muted hover:text-ink sm:inline">{t('선택 해제', 'Clear selection')}</button>
                <button type="button" onClick={remove} disabled={!!busy} className="whitespace-nowrap rounded border border-line px-3 py-2 text-sm text-muted hover:border-danger/40 hover:text-danger md:px-4">{t('삭제', 'Delete')}{deletable.length ? ` ${deletable.length}` : ''}</button>
                {canReview && <>
                  <button type="button" onClick={startReject} disabled={!!busy} className="whitespace-nowrap rounded border border-danger/40 px-3 py-2 text-sm text-danger hover:bg-danger/5 md:px-4">{t('반려', 'Reject')}{reviewable.length ? ` ${reviewable.length}` : ''}</button>
                  <button type="button" onClick={approve} disabled={!!busy} className="btn-publish whitespace-nowrap !px-3 md:!px-4">{busy ?? `${t('승인·발행', 'Approve & publish')}${reviewable.length ? ` ${reviewable.length}` : ''}`}</button>
                </>}
                {!canReview && busy && <span className="text-[13px] text-muted">{busy}</span>}
              </>
            )}
          </div>
        </div>
      )}
    </BulkCtx.Provider>
  )
}

// 줄마다 붙는 고르기 칸
export function BulkCheck({ id, title }: { id: string; title: string }) {
  const t = useT()
  const ctx = useContext(BulkCtx)
  if (!ctx || !ctx.items.some((i) => i.id === id)) return null
  return (
    <input
      type="checkbox"
      checked={ctx.selected.has(id)}
      onChange={() => ctx.toggle(id)}
      aria-label={t(`“${title}” 고르기`, `Select “${title}”`)}
      className="h-4 w-4 shrink-0 cursor-pointer accent-review"
    />
  )
}
