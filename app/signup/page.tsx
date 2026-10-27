import Link from 'next/link'
import { headers } from 'next/headers'
import { IOS_ORG_ONLY_NOTICE, isIosAppUA } from '@/lib/ios-app'
import { createClient } from '@supabase/supabase-js'
import AuthShell from '@/components/auth/AuthShell'
import SignupForm from '@/components/auth/SignupForm'
import { BRAND_ICONS } from '@/lib/brand'
import { getPublicT } from '@/lib/cms-t-public'

export const dynamic = 'force-dynamic'
export async function generateMetadata() {
  const { t } = await getPublicT()
  return { title: t('회원가입 | IM 뉴스룸', 'Sign up | IM Newsroom'), icons: BRAND_ICONS }
}

// 승인 칸(signup.sql)이 없으면 가입하자마자 기사를 쓸 수 있게 되므로 가입을 열지 않는다
async function signupReady() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return false
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  const { error } = await supabase.from('profiles').select('approved').limit(1)
  return !error
}

// 가입 화면에서 고를 소속 매체 (signup-outlet.sql 전이면 빈 목록 → 고르기 칸을 숨긴다)
async function signupOutlets() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  const { data, error } = await supabase.rpc('signup_outlets')
  return error ? [] : ((data ?? []) as { id: string; name: string }[])
}

export default async function SignupPage() {
  const { t, lang } = await getPublicT()
  if (isIosAppUA((await headers()).get('user-agent'))) {
    return (
      <AuthShell lang={lang} subtitle={t('언론사 구성원 전용', 'For newsroom members only')} footer={<Link href="/login" className="font-semibold text-ink underline underline-offset-2">{t('로그인 화면으로', 'Go to sign in')}</Link>}>
        <p className="rounded-lg border border-line bg-white px-6 py-7 text-center text-sm leading-relaxed text-muted">{t(IOS_ORG_ONLY_NOTICE, 'This app is for members of newsrooms that use IM Newsroom only. Accounts are created by your newsroom’s publisher through an invitation email.')}</p>
      </AuthShell>
    )
  }
  if (await signupReady()) return <SignupForm lang={lang} outlets={await signupOutlets()} />
  return (
    <AuthShell lang={lang} subtitle={t('회원가입', 'Sign up')} footer={<Link href="/login" className="font-semibold text-ink underline underline-offset-2">{t('로그인 화면으로', 'Go to sign in')}</Link>}>
      <p className="rounded-lg border border-line bg-white px-6 py-7 text-center text-sm leading-relaxed text-muted">
        {t('회원가입을 준비 중입니다. 관리자에게 문의해 주세요.', 'Sign-up is not available yet. Please contact your administrator.')}
      </p>
    </AuthShell>
  )
}
