'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { GdpaLang } from '@/lib/gdpa'

// 위쪽 로그인 영역: 로그인 전 = 로그인·회원가입 / 로그인 후 = 내 정보·로그아웃
export default function GdpaUserNav({ base, lang = 'ko', className = '' }: { base: string; lang?: GdpaLang; className?: string }) {
  const en = lang === 'en'
  const router = useRouter()
  const [email, setEmail] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) { setEmail(null); return }
    const sb = createClient()
    sb.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null))
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setEmail(s?.user?.email ?? null))
    return () => sub.subscription.unsubscribe()
  }, [])
  async function logout() {
    await createClient().auth.signOut()
    router.push(base || '/')
    router.refresh()
  }
  if (email === undefined) return <span className={className} aria-hidden />
  return (
    <span className={`flex items-center gap-4 ${className}`}>
      {email ? (
        <>
          <a href={`${base}/mypage`} className="hover:text-white">{en ? 'My account' : '내 정보'}</a>
          <button type="button" onClick={logout} className="hover:text-white">{en ? 'Log out' : '로그아웃'}</button>
        </>
      ) : (
        <>
          <a href={`${base}/login`} className="hover:text-white">{en ? 'Log in' : '로그인'}</a>
          <a href={`${base}/signup`} className="hover:text-white">{en ? 'Sign up' : '회원가입'}</a>
        </>
      )}
    </span>
  )
}
