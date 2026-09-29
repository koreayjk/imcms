import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import AuthShell from '@/components/auth/AuthShell'
import SignupForm from '@/components/auth/SignupForm'

export const dynamic = 'force-dynamic'
export const metadata = { title: '회원가입 | IM CMS' }

// 승인 칸(signup.sql)이 없으면 가입하자마자 기사를 쓸 수 있게 되므로 가입을 열지 않는다
async function signupReady() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return false
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  const { error } = await supabase.from('profiles').select('approved').limit(1)
  return !error
}

export default async function SignupPage() {
  if (await signupReady()) return <SignupForm />
  return (
    <AuthShell subtitle="회원가입" footer={<Link href="/login" className="font-semibold text-ink underline underline-offset-2">로그인 화면으로</Link>}>
      <p className="rounded-lg border border-line bg-white px-6 py-7 text-center text-sm leading-relaxed text-muted">
        회원가입을 준비 중입니다. 관리자에게 문의해 주세요.
      </p>
    </AuthShell>
  )
}
