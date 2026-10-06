'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { formatDateTime } from '@/lib/format'
import { setGroupRequireMfa } from '@/app/(main)/account/actions'

type Factor = { id: string; name: string; createdAt: string }

// 내 정보 > 2단계 인증: 등록한 인증 앱, 추가·삭제, (발행인) 우리 그룹 필수 설정
export default function MfaSettings({ factors, required, group }: {
  factors: Factor[]
  required: boolean
  group: { name: string | null; on: boolean } | null
}) {
  const router = useRouter()
  const [error, setError] = useState('')
  const [pending, start] = useTransition()

  function remove(f: Factor) {
    const last = factors.length === 1
    const msg = last && required
      ? '이 계정은 2단계 인증이 필수라, 지우면 바로 새 인증 앱을 등록해야 합니다. 지울까요?'
      : last ? '2단계 인증을 끌까요? 비밀번호만으로 로그인하게 됩니다.' : `“${f.name}”을(를) 지울까요?`
    if (!confirm(msg)) return
    start(async () => {
      setError('')
      const { error: err } = await createClient().auth.mfa.unenroll({ factorId: f.id })
      if (err) return setError(`지우지 못했습니다: ${err.message}`)
      router.refresh()
    })
  }

  function toggleGroup(on: boolean) {
    start(async () => {
      setError('')
      const r = await setGroupRequireMfa(on)
      if (r.error) setError(r.error)
      router.refresh()
    })
  }

  return (
    <section className="space-y-3 border-t border-line pt-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-bold">2단계 인증</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">새 기기에서 로그인할 때 휴대폰 인증 앱의 6자리 코드를 한 번 더 넣습니다. 비밀번호가 새어도 들어올 수 없습니다.</p>
        </div>
        <span className={`rounded px-2 py-0.5 text-[12px] font-bold ${factors.length ? 'bg-published/10 text-published' : 'bg-line text-muted'}`}>{factors.length ? '켜짐' : '꺼짐'}</span>
      </div>
      {required && !factors.length && <p className="text-[12.5px] text-danger">이 계정은 2단계 인증이 필수입니다.</p>}
      {factors.length > 0 && (
        <ul className="divide-y divide-line rounded-md border border-line">
          {factors.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
              <span className="min-w-0 flex-1 truncate">{f.name}</span>
              <span className="shrink-0 text-[12px] text-muted">{formatDateTime(f.createdAt)}</span>
              <button type="button" disabled={pending} onClick={() => remove(f)} className="shrink-0 text-[12.5px] text-muted underline underline-offset-2 hover:text-danger">지우기</button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/login/mfa/setup" className="btn-secondary px-3 py-1.5 text-[13px]">{factors.length ? '다른 기기 인증 앱 추가' : '2단계 인증 켜기'}</Link>
        {factors.length === 1 && <span className="text-[12px] text-muted">휴대폰을 잃어버릴 때를 대비해 하나 더 등록해 두면 좋습니다.</span>}
      </div>
      {group && (
        <label className="mt-1 flex items-start gap-2.5 rounded-md bg-paper px-3.5 py-3 text-[13px]">
          <input type="checkbox" checked={group.on} disabled={pending} onChange={(e) => toggleGroup(e.target.checked)} className="mt-0.5 h-4 w-4" />
          <span>
            <strong>{group.name ?? '우리 그룹'} 발행인·편집장은 2단계 인증 필수</strong>
            <span className="block text-[12px] text-muted">켜면 발행인·편집장은 인증 앱을 등록해야 편집국을 씁니다. 기자는 각자 선택합니다.</span>
          </span>
        </label>
      )}
      {error && <p role="alert" className="text-[12.5px] text-danger">{error}</p>}
    </section>
  )
}
