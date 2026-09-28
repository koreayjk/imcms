'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.')
      setLoading(false)
      return
    }
    router.push('/newsroom')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <div className="w-full max-w-sm px-4">
        <div className="mb-10 text-center">
          <h1 className="text-xl font-semibold tracking-tight">IM CMS</h1>
          <p className="mt-1.5 text-sm text-muted">언론사 기사 관리 시스템</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="field-label">이메일</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="field-input"
              placeholder="reporter@example.com"
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="password" className="field-label">비밀번호</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="field-input"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-sm text-danger">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full"
          >
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>

        <p className="mt-8 text-center text-xs text-muted">
          계정이 없으시면 관리자에게 문의하세요.
        </p>
      </div>
    </div>
  )
}
