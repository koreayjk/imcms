'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function ReviewActions({ articleId }: { articleId: string }) {
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function approve() {
    setLoading(true)
    await supabase.from('articles').update({
      status: 'published',
      published_at: new Date().toISOString(),
      reject_reason: null,
    }).eq('id', articleId)
    router.refresh()
    setLoading(false)
  }

  async function reject() {
    if (!reason.trim()) return
    setLoading(true)
    await supabase.from('articles').update({
      status: 'rejected',
      reject_reason: reason.trim(),
    }).eq('id', articleId)
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
