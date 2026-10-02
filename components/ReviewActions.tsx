'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { describe, syndicate } from '@/lib/syndicate'
import { notifyArticle } from '@/app/(main)/articles/notify'

// presetAt: 기자가 정해 둔 발행 일시 (있으면 그 시각으로 발행 — 앞으로의 시각이면 예약 발행)
export default function ReviewActions({ articleId, presetAt = null }: { articleId: string; presetAt?: string | null }) {
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function approve() {
    const scheduled = presetAt && Date.parse(presetAt) > Date.now()
    if (scheduled && !window.confirm(`기자가 정한 발행 일시(${new Date(presetAt).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })})로 예약 발행합니다. 그 전까지는 홈페이지에 보이지 않습니다.`)) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('articles').update({
      status: 'published',
      published_at: presetAt ?? new Date().toISOString(),
      reviewed_by: user?.id ?? null,
      reject_reason: null,
    }).eq('id', articleId)
    if (error) {
      window.alert(`승인하지 못했습니다: ${error.message}`)
    } else {
      notifyArticle(articleId, 'published').catch(() => {})
      try {
        const summary = describe(await syndicate(articleId))
        if (summary) window.alert(summary)
      } catch (e) {
        window.alert(`함께 송고 중 문제가 생겼습니다: ${e instanceof Error ? e.message : ''}`)
      }
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
      <div className="flex items-end gap-2">
        <div>
          <label className="field-label">반려 사유 *</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="기자에게 전달할 반려 사유를 입력하세요"
            className="w-72 rounded border border-line px-3 py-2 text-sm focus:outline-none focus:border-danger"
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && reject()}
          />
        </div>
        <button
          onClick={reject}
          disabled={!reason.trim() || loading}
          className="btn-danger"
        >
          반려 확정
        </button>
        <button
          onClick={() => { setShowReject(false); setReason('') }}
          className="text-sm text-muted hover:text-ink"
        >
          취소
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
        반려
      </button>
      <button
        onClick={approve}
        disabled={loading}
        className="btn-publish"
      >
        {loading ? '처리 중...' : '승인 · 발행'}
      </button>
    </div>
  )
}
