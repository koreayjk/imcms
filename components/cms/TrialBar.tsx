'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { switchTrialRole, type TrialRole } from '@/app/(main)/account/trial'

const ROLES: { key: TrialRole; label: string; tip: string }[] = [
  { key: 'reporter', label: '기자', tip: '기사 쓰기 · AI 초안·검수 · 승인신청' },
  { key: 'editor', label: '편집장', tip: '기사 승인·발행 · 홈 편집 · 광고 · 뉴스레터' },
  { key: 'group', label: '그룹장', tip: '그룹 매체 · 회원 관리 · AI 사용량 화면' },
]

// 체험 계정 맨 위 띠: 남은 기간 · 역할 바꾸기 · 안내 · 정식 신청
export default function TrialBar({ role, daysLeft }: { role: string | null; daysLeft: number }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [error, setError] = useState('')
  const now: TrialRole = role === 'admin' ? 'group' : role === 'editor' ? 'editor' : 'reporter'
  const pick = (r: TrialRole) => {
    if (r === now) return
    setError('')
    start(async () => {
      const res = await switchTrialRole(r)
      if (res.error) { setError(res.error); return }
      router.push('/newsroom')
      router.refresh()
    })
  }

  return (
    <div className="border-b border-[#1F3A5F]/20 bg-[#EEF3F9] px-4 py-2 text-[12.5px] text-[#1F3A5F] print:hidden">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="font-bold">체험 중 · {daysLeft > 0 ? `${daysLeft}일 남음` : '오늘 끝남'}</span>
        <span className="flex items-center gap-1" role="group" aria-label="체험 역할 바꾸기">
          <span className="mr-1 text-[#1F3A5F]/70">역할</span>
          {ROLES.map((r) => (
            <button key={r.key} type="button" title={r.tip} aria-pressed={now === r.key} disabled={pending}
              onClick={() => pick(r.key)}
              className={`rounded-full px-3 py-1 font-semibold transition ${now === r.key ? 'bg-[#1F3A5F] text-white' : 'bg-white text-[#1F3A5F] ring-1 ring-[#1F3A5F]/25 hover:bg-[#1F3A5F]/10'} disabled:opacity-60`}>
              {r.label}
            </button>
          ))}
        </span>
        <span className="hidden text-[#1F3A5F]/75 lg:inline">🔒 샘플 기사는 수정·삭제할 수 없고, 기사는 내가 쓴 것만 지울 수 있어요.</span>
        <a href="/imnewsroom#apply" className="ml-auto rounded bg-[#1F3A5F] px-3 py-1 font-semibold text-white hover:brightness-110">정식 신청</a>
      </div>
      {error && <p role="alert" className="mt-1 text-danger">{error}</p>}
    </div>
  )
}
