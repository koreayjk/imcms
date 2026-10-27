'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { describe, syndicate } from '@/lib/syndicate'
import { notifyArticle } from '@/app/(main)/articles/notify'
import { refreshArticlePages } from '@/app/(main)/articles/refresh'
import { trialPublish } from '@/app/(main)/articles/moderation'
import { useT, useCmsLang } from '@/components/cms/CmsLang'

// presetAt: 기자가 정해 둔 발행 일시 (있으면 그 시각으로 발행 — 앞으로의 시각이면 예약 발행)
// moderated: 체험 계정 — 서버가 욕설·혐오·선정성을 검사한 뒤 발행한다 (trial-moderation.sql)
export default function ReviewActions({ articleId, presetAt = null, hasSection = true, moderated = false }: { articleId: string; presetAt?: string | null; hasSection?: boolean; moderated?: boolean }) {
  const t = useT()
  const lang = useCmsLang()
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function approve() {
    if (!hasSection) { window.alert(t('섹션이 정해지지 않은 기사는 발행할 수 없습니다. 수정 화면에서 섹션을 고른 뒤 승인해 주세요.', 'A story without a section cannot be published. Choose a section in the edit screen, then approve it.')); return }
    const scheduled = presetAt && Date.parse(presetAt) > Date.now()
    if (scheduled && !window.confirm(t(`기자가 정한 발행 일시(${new Date(presetAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })})로 예약 발행합니다. 그 전까지는 홈페이지에 보이지 않습니다.`, `This will be scheduled for the publish time the reporter set (${new Date(presetAt).toLocaleString('en-US', { timeZone: 'Asia/Seoul' })} KST). It will not appear on the home page until then.`))) return
    setLoading(true)
    let error: { message: string } | null = null
    if (moderated) {
      const r = await trialPublish(articleId, presetAt)
      if (!r.ok) {
        window.alert(r.held
          ? t(`욕설·혐오·선정적 표현이 있을 수 있어 바로 발행되지 않았습니다.\n총관리자가 확인한 뒤 발행됩니다.\n\n사유: ${r.note}`, `The story may contain profanity, hate speech, or sensational wording, so it was not published right away.\nIt will be published after the Super Admin reviews it.\n\nReason: ${r.note}`)
          : t(`승인하지 못했습니다: ${r.error}`, `Could not approve: ${r.error}`))
        router.refresh()
        setLoading(false)
        return
      }
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      ;({ error } = await supabase.from('articles').update({
        status: 'published',
        published_at: presetAt ?? new Date().toISOString(),
        reviewed_by: user?.id ?? null,
        reject_reason: null,
      }).eq('id', articleId))
    }
    if (error) {
      window.alert(t(`승인하지 못했습니다: ${error.message}`, `Could not approve: ${error.message}`))
    } else {
      try {
        const summary = describe(await syndicate(articleId, { lang }), lang)
        if (summary) window.alert(summary)
      } catch (e) {
        window.alert(t(`함께 송고 중 문제가 생겼습니다: ${e instanceof Error ? e.message : ''}`, `There was a problem syndicating the story: ${e instanceof Error ? e.message : ''}`))
      }
      // 홈페이지에 바로 보이게
      await refreshArticlePages(articleId).catch(() => {})
    }
    router.refresh()
    setLoading(false)
  }

  async function reject() {
    if (!reason.trim()) return
    setLoading(true)
    const { error } = await supabase.from('articles').update({
      status: 'rejected',
      reject_reason: reason.trim(),
    }).eq('id', articleId)
    if (!error) notifyArticle(articleId, 'rejected').catch(() => {})
    setShowReject(false)
    router.refresh()
    setLoading(false)
  }

  if (showReject) {
    return (
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-full sm:w-auto">
          <label className="field-label">{t('반려 사유 *', 'Rejection reason *')}</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('기자에게 전달할 반려 사유를 입력하세요', 'Enter the rejection reason to send to the reporter')}
            className="w-full rounded border border-line px-3 py-2 sm:w-72 text-sm focus:outline-none focus:border-danger"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && reject()}
          />
        </div>
        <button
          onClick={reject}
          disabled={!reason.trim() || loading}
          className="btn-danger"
        >
          {t('반려 확정', 'Confirm rejection')}
        </button>
        <button
          onClick={() => { setShowReject(false); setReason('') }}
          className="text-sm text-muted hover:text-ink"
        >
          {t('취소', 'Cancel')}
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => setShowReject(true)}
        className="rounded border border-danger/40 px-4 py-2 text-sm text-danger hover:bg-danger/5 transition-colors"
      >
        {t('반려', 'Reject')}
      </button>
      <button
        onClick={approve}
        disabled={loading}
        className="btn-publish"
      >
        {loading ? t('처리 중...', 'Processing...') : t('승인 · 발행', 'Approve & Publish')}
      </button>
    </div>
  )
}
