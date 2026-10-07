'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveAdDocument } from '@/app/doc/ad/actions'
import PrintButton from './PrintButton'
import type { AdDocKind } from '@/lib/ad-doc'

// 문서 위 버튼: [저장] [PDF 다운 · 인쇄]. 저장하면 번호가 매겨진 보관본으로 넘어간다
export default function AdDocToolbar({ contractId, kind }: { contractId: string; kind: AdDocKind }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const name = kind === 'quote' ? '견적서' : '게재 확인서'
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button type="button" disabled={pending} className="btn-primary"
          onClick={() => start(async () => {
            setError('')
            const r = await saveAdDocument(contractId, kind)
            if (r.error || !r.id) return setError(r.error ?? '저장하지 못했습니다.')
            router.push(`/doc/saved/${r.id}?new=1`)
          })}>
          {pending ? '저장 중…' : `💾 ${name} 저장`}
        </button>
        <PrintButton />
      </div>
      {error && <p role="alert" className="text-[12.5px] text-danger">{error}</p>}
    </div>
  )
}
