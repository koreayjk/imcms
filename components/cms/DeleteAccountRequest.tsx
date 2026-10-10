'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { requestAccountDeletion } from '@/app/(main)/account/actions'

// 내 정보 → 계정 삭제 요청: 고객센터에 요청을 남기고 그 요청 화면으로 간다
export default function DeleteAccountRequest() {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function send() {
    if (!window.confirm('계정 삭제를 요청할까요?\n\n· 운영팀이 확인한 뒤 7일 안에 계정을 지우고 메일로 알려 드립니다.\n· 지우면 다시 로그인할 수 없고 되돌릴 수 없습니다.\n· 쓴 기사는 언론사 기사로 기자명과 함께 남습니다.')) return
    setBusy(true)
    setError(null)
    const r = await requestAccountDeletion(reason).catch((e) => ({ error: e instanceof Error ? e.message : '오류', id: undefined }))
    setBusy(false)
    if (r.error || !r.id) { setError(r.error ?? '요청하지 못했습니다.'); return }
    router.push(`/support/tickets/${r.id}`)
  }

  return (
    <section className="space-y-3 border-t border-line pt-5">
      <div>
        <h2 className="text-[15px] font-bold">계정 삭제</h2>
        <p className="mt-0.5 text-[12.5px] text-muted">
          더 이상 편집국을 쓰지 않으면 계정 삭제를 요청할 수 있습니다. 이름·이메일·로그인 기록이 지워지고, 쓴 기사는 언론사 기사로 기자명과 함께 남습니다.
        </p>
      </div>
      {open ? (
        <div className="space-y-2">
          <label htmlFor="delete-reason" className="block text-[13px] font-semibold">삭제하려는 이유 (선택)</label>
          <textarea id="delete-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} rows={3} className="field-input w-full" placeholder="예: 퇴사했습니다" />
          {error && <p className="text-[13px] text-danger" role="alert">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={send} disabled={busy} className="btn-danger">{busy ? '요청 중…' : '계정 삭제 요청 보내기'}</button>
            <button type="button" onClick={() => setOpen(false)} disabled={busy} className="px-3 text-[13px] text-muted hover:text-ink">취소</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="rounded border border-danger/40 px-4 py-2 text-[13.5px] text-danger hover:bg-danger/5">계정 삭제 요청</button>
      )}
    </section>
  )
}
