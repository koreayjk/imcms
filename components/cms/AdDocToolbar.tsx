'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveAdDocument } from '@/app/doc/ad/actions'
import type { AdDocKind } from '@/lib/ad-doc'

// 문서 위 버튼: [PDF 다운 · 인쇄] 누르면 번호를 매겨 저장한 뒤 인쇄 창을 연다 (발행 = 저장)
//   [저장만]은 인쇄하지 않고 보관만. 내용이 바뀌지 않았으면 새 번호를 매기지 않는다
export default function AdDocToolbar({ contractId, kind }: { contractId: string; kind: AdDocKind }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const issue = (print: boolean) => start(async () => {
    setError('')
    const r = await saveAdDocument(contractId, kind)
    if (r.error || !r.id) return setError(r.error ?? '저장하지 못했습니다.')
    router.push(`/doc/saved/${r.id}?${r.reused ? 'same=1' : 'new=1'}${print ? `&print=${Date.now()}` : ''}`)
  })
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <button type="button" disabled={pending} onClick={() => issue(false)} className="btn-secondary bg-white">저장만</button>
        <button type="button" disabled={pending} onClick={() => issue(true)} className="btn-primary">{pending ? '저장하는 중…' : '⬇ PDF 다운 · 인쇄'}</button>
      </div>
      {error && <p role="alert" className="text-[12.5px] text-danger">{error}</p>}
    </div>
  )
}
