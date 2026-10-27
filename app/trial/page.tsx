import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { PRODUCT, isAppHost, isProductHost } from '@/lib/product'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import TrialSignupForm from '@/components/auth/TrialSignupForm'
import SignOutButton from '@/components/auth/SignOutButton'
import { isApproved } from '@/lib/cms'
import AuthShell from '@/components/auth/AuthShell'
import { IOS_ORG_ONLY_NOTICE, isIosAppUA } from '@/lib/ios-app'
import { getPublicT } from '@/lib/cms-t-public'
import LangToggle from '@/components/auth/LangToggle'

// 소개 사이트·편집국 주소(imnewsroom.com, app.imnewsroom.com)로 들어온 경우에만 검색에 노출한다
export async function generateMetadata(): Promise<Metadata> {
  const { t, lang } = await getPublicT()
  const host = (await headers()).get('host')
  const indexable = PRODUCT.indexable && (isProductHost(host) || isAppHost(host))
  return {
    title: t('1주일 무료 체험 | IM 뉴스룸', '1-week free trial | IM Newsroom'),
    description: t('샘플 기사가 채워진 체험용 신문에서 기자·편집장·그룹장 역할을 바꿔 가며 IM 뉴스룸을 7일 동안 무료로 써 보세요.', 'Try IM Newsroom free for 7 days in a demo newspaper filled with sample stories, switching between the Reporter, Editor-in-Chief and Group Manager roles.'),
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { type: 'website', siteName: PRODUCT.name, title: t('1주일 무료 체험 | IM 뉴스룸', '1-week free trial | IM Newsroom'), description: t('카드 등록 없이 7일 동안 IM 뉴스룸을 우리 신문처럼 써 보세요.', 'Use IM Newsroom like your own newspaper for 7 days, no card required.'), locale: lang === 'en' ? 'en_US' : 'ko_KR', images: [{ url: PRODUCT.ogImage, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', images: [PRODUCT.ogImage] },
    ...(indexable ? { alternates: { canonical: `${PRODUCT.appLive ? PRODUCT.appUrl : PRODUCT.url}/trial` } } : {}),
  }
}

// 언어별 두 벌 (모듈 상수에는 t 를 쓸 수 없다)
const TRY = {
  ko: [
    ['기자', '기사 쓰기, 보도자료로 AI 초안 만들기, AI 법적 검수, 사진 넣기, 승인신청'],
    ['편집장', '승인신청된 기사 승인·반려·발행, 홈 편집판으로 첫 화면 배치, 광고·팝업, 뉴스레터 미리보기'],
    ['그룹장', '여러 매체를 묶는 그룹 관리, 회원 관리·AI 사용량 화면 둘러보기'],
  ],
  en: [
    ['Reporter', 'Write stories, create AI drafts from press releases, run an AI legal check, add photos, submit for review'],
    ['Editor-in-Chief', 'Approve, reject and publish submitted stories, lay out the front page with the home layout editor, ads and pop-ups, newsletter preview'],
    ['Group Manager', 'Manage a group of outlets, browse the member management and AI usage screens'],
  ],
}
const RULES = {
  ko: [
    '체험 기간은 가입한 때부터 7일입니다. 카드 등록이나 결제는 없습니다.',
    '체험하는 분들이 모두 같은 체험용 신문 ‘IM 체험뉴스’를 함께 씁니다.',
    '샘플 기사(🔒)는 수정·삭제할 수 없고, 기사는 내가 쓴 것만 지울 수 있습니다.',
    'AI 초안·검수는 1인 30회까지 써 볼 수 있습니다.',
    '체험 중 쓴 기사는 7일 뒤 자동으로 지워집니다. 연습용으로 써 주세요.',
  ],
  en: [
    'The trial lasts 7 days from sign-up. There is no card registration or payment.',
    'Everyone trying the product shares the same demo newspaper, “IM Trial News”.',
    'Sample stories (🔒) cannot be edited or deleted, and you can delete only stories you wrote.',
    'You can use AI drafts and checks up to 30 times per person.',
    'Stories you write during the trial are deleted automatically after 7 days. Use them for practice.',
  ],
}

export default async function TrialPage() {
  const { t, lang } = await getPublicT()
  if (isIosAppUA((await headers()).get('user-agent'))) {
    return (
      <AuthShell lang={lang} subtitle={t('언론사 구성원 전용', 'For newsroom members only')} footer={<Link href="/login" className="font-semibold text-ink underline underline-offset-2">{t('로그인 화면으로', 'Go to sign in')}</Link>}>
        <p className="rounded-lg border border-line bg-white px-6 py-7 text-center text-sm leading-relaxed text-muted">{t(IOS_ORG_ONLY_NOTICE, 'This app is for members of newsrooms that use IM Newsroom only. Accounts are created by your newsroom’s publisher through an invitation email.')}</p>
      </AuthShell>
    )
  }
  let loggedIn = false
  // 구글로 들어왔지만 체험 계정 만들기를 마치지 않은 회원 (승인 전 일반 회원)
  let unfinished = false
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supabase = await createServerSupabaseClient()
    const user = (await supabase.auth.getUser()).data.user
    loggedIn = !!user
    if (user) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
      unfinished = !!p && !p.trial_until && !isApproved(p)
    }
  }
  const demo = process.env.NEXT_PUBLIC_TRIAL_SITE_URL ?? 'https://imnews-demo.vercel.app'

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto grid grid-cols-1 max-w-[1080px] gap-10 px-4 py-12 md:grid-cols-[minmax(0,1fr)_440px] md:py-16">
        <LangToggle className="md:col-span-2 md:-mb-6" />
        <div>
          <p className="text-[12.5px] font-bold tracking-[0.2em] text-muted">IM NEWSROOM · FREE TRIAL</p>
          <h1 className="mt-3 text-[30px] font-extrabold leading-[1.3] tracking-[-0.03em] md:text-[38px]">{lang === 'en' ? <>Try it free for 7 days,<br />as if it were your own newspaper</> : <>7일 동안 무료로<br />우리 신문처럼 써 보세요</>}</h1>
          <p className="mt-4 text-[15.5px] leading-[1.8] text-muted">
            {t('샘플 기사가 채워진 체험용 신문에서 기자 · 편집장 · 그룹장 역할을 바꿔 가며 IM 뉴스룸의 모든 화면을 직접 써 볼 수 있습니다.', 'In a demo newspaper filled with sample stories, switch between the Reporter, Editor-in-Chief and Group Manager roles and try every screen in IM Newsroom yourself.')}
          </p>
          <a href={demo} target="_blank" rel="noopener" className="mt-5 inline-block text-[14px] font-semibold underline underline-offset-4">{t('체험용 신문 홈페이지 먼저 보기 ↗', 'View the demo newspaper’s homepage first ↗')}</a>

          <h2 className="mt-10 text-[16px] font-bold">{t('역할마다 써 볼 수 있는 것', 'What you can try in each role')}</h2>
          <ul className="mt-3 space-y-2.5">
            {TRY[lang].map(([r, d]) => (
              <li key={r} className="flex gap-3 rounded-lg border border-line bg-white p-4">
                <span className="w-14 shrink-0 font-bold">{r}</span>
                <span className="text-[14px] leading-[1.7] text-muted">{d}</span>
              </li>
            ))}
          </ul>
          <h2 className="mt-8 text-[16px] font-bold">{t('체험 안내', 'About the trial')}</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[14px] leading-[1.7] text-muted">
            {RULES[lang].map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>

        <div>
          {unfinished ? (
            <div className="rounded-lg border border-line bg-white p-6 text-center">
              <p className="font-bold">{t('체험 계정 만들기를 마쳐 주세요', 'Finish creating your trial account')}</p>
              <p className="mt-2 text-[14px] text-muted">{t('소속 언론사와 연락처를 적으면 바로 체험을 시작합니다.', 'Enter your news organization and contact details to start the trial right away.')}</p>
              <Link href="/trial/complete" className="btn-primary mt-4 inline-block">{t('이어서 하기', 'Continue')}</Link>
            </div>
          ) : loggedIn ? (
            <div className="rounded-lg border border-line bg-white p-6 text-center">
              <p className="font-bold">{t('이미 로그인돼 있습니다', 'You are already signed in')}</p>
              <p className="mt-2 text-[14px] text-muted">{t('체험 계정이면 편집국에서 바로 이어서 쓰면 됩니다. 다른 계정으로 체험을 신청하려면 로그아웃해 주세요.', 'If this is a trial account, just continue in the newsroom. To apply for a trial with another account, please sign out first.')}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Link href="/newsroom" className="btn-primary">{t('편집국으로', 'Go to the newsroom')}</Link>
                <SignOutButton next="/trial" label={t('로그아웃하고 체험 신청', 'Sign out and apply for a trial')} />
              </div>
            </div>
          ) : (
            <>
              <TrialSignupForm />
              <p className="mt-4 text-center text-[13px] text-muted">{t('이미 체험 계정이 있으신가요?', 'Already have a trial account?')} <Link href="/login" className="font-semibold text-ink underline underline-offset-2">{t('로그인', 'Sign in')}</Link></p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
