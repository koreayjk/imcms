'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

// next: 로그아웃한 뒤 갈 곳 (기본은 로그인 화면), label: 버튼 글자
export default function SignOutButton({ next = '/login', label = '로그아웃' }: { next?: string; label?: string }) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={async () => {
        await createClient().auth.signOut()
        router.push(next)
        router.refresh()
      }}
      className="btn-secondary"
    >
      {label}
    </button>
  )
}
