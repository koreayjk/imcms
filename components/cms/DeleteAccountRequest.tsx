'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteMyAccount, requestAccountDeletion } from '@/app/(main)/account/actions'

// 내 정보 → 계정 삭제: 확인 칸에 "삭제"를 적으면 바로 지우고 로그인 화면으로 간다 (애플 앱 심사 5.1.1(v))
//   바로 삭제를 아직 못 쓰면(self-delete.sql 전) 고객센터 요청으로 대신한다
export default function DeleteAccountRequest({ manager = false }: { manager?: boolean }) {
  const [open, setOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [fallback, setFallback] = useState(false)
  const router = useRouter()

  async function remove() {
    if (!window.confirm('정말 계정을 지울까요?\n\n· 바로 지워지고 되돌릴 수 없습니다.\n· 다시 로그인할 수 없습니다.\n· 쓴 기사는 언론사 기사로 기자명과 함께 남습니다.')) return
    setBusy(true)
    setError(null)
    const r = await deleteMyAccount(confirmText).catch((e) => ({ error: e instanceof Error ? e.message : '오류', ok: false }))
    if (r.error || !r.ok) {
      setBusy(false)
      setError(r.error ?? '지우지 못했습니다.')
      setFallback(/고객센터/.test(r.error ?? ''))
      return
    }
    window.location.replace('/login?deleted=1')
  }

  async function request() {
    setBusy(true)
    const r = await requestAccountDeletion('').catch((e) => ({ error: e instanceof Error ? e.message : '오류', id: undefined }))
    setBusy(false)
    if (r.error || !r.id) { setError(r.error ?? '요청하지 못했습니다.'); return }
    router.push(`/support/tickets/${r.id}`)
  }

  return (
    <section className="space-y-3 border-t border-line pt-5">
      <div>
        <h2 className="text-[15px] font-bold">계정 삭제</h2>
        <p className="mt-0.5 text-[12.5px] text-muted">
          더 이상 편집국을 쓰지 않으면 계정을 바로 지울 수 있습니다. 이름·이메일·로그인 기록·내 업무요청이 지워지고, 쓴 기사는 언론사 기사로 기자명과 함께 남습니다.
        </p>
      </div>
      {open ? (
        <div className="space-y-2.5 rounded-lg border border-danger/30 bg-danger/5 p-3.5">
          <ul className="list-disc space-y-1 pl-5 text-[12.5px] leading-relaxed text-[#5C2B26]">
            <li>지우면 바로 로그아웃되고 이 계정으로 다시 로그인할 수 없습니다. 되돌릴 수 없습니다.</li>
            <li>언론사·매체 홈페이지와 기사는 그대로 남습니다.</li>
            {manager && <li>편집장·발행인이 지워도 매체는 그대로입니다. 매체를 관리할 사람이 없어지면 운영팀이 새로 정해 드립니다.</li>}
          </ul>
          <label htmlFor="delete-confirm" className="block text-[13px] font-semibold">확인을 위해 <strong className="text-danger">삭제</strong>라고 적어 주세요</label>
          <input id="delete-confirm" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" className="field-input w-full max-w-[220px]" placeholder="삭제" />
          {error && <p className="text-[13px] text-danger" role="alert">{error}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={remove} disabled={busy || confirmText.trim() !== '삭제'} className="btn-danger">{busy ? '지우는 중…' : '지금 계정 삭제'}</button>
            {fallback && <button type="button" onClick={request} disabled={busy} className="btn-secondary">고객센터로 삭제 요청</button>}
            <button type="button" onClick={() => { setOpen(false); setConfirmText(''); setError(null) }} disabled={busy} className="px-3 text-[13px] text-muted hover:text-ink">취소</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="rounded border border-danger/40 px-4 py-2 text-[13.5px] text-danger hover:bg-danger/5">계정 삭제</button>
      )}
    </section>
  )
}
