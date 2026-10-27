'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { useT } from '@/components/cms/CmsLang'

// next: 로그아웃한 뒤 갈 곳 (기본은 로그인 화면), label: 버튼 글자
export default function SignOutButton({ next = '/login', label }: { next?: string; label?: string }) {
  const t = useT()
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
      {label ?? t('로그아웃', 'Sign out')}
    </button>
  )
}
