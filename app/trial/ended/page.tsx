import type { Metadata } from 'next'
import SignOutButton from '@/components/auth/SignOutButton'
import LangToggle from '@/components/auth/LangToggle'
import { getPublicT } from '@/lib/cms-t-public'

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getPublicT()
  return { title: t('체험 기간 종료 | IM 뉴스룸', 'Trial ended | IM Newsroom'), robots: { index: false, follow: false } }
}

// 체험 기간이 끝난 계정이 편집국에 들어오면 여기로 온다 (lib/cms.ts)
export default async function TrialEndedPage() {
  const { t } = await getPublicT()
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-md rounded-lg border border-line bg-white p-8 text-center">
        <LangToggle className="-mt-2 mb-4" />
        <p className="text-[12.5px] font-bold tracking-[0.2em] text-muted">IM NEWSROOM</p>
        <h1 className="mt-3 text-[24px] font-extrabold tracking-tight">{t('7일 체험이 끝났습니다', 'Your 7-day trial has ended')}</h1>
        <p className="mt-3 text-[14.5px] leading-[1.8] text-muted">
          {t('IM 뉴스룸을 써 주셔서 감사합니다. 정식으로 신청하시면 우리 언론사 이름과 도메인으로 홈페이지를 만들어 드리고, 기자 계정도 바로 연결해 드립니다.', 'Thank you for trying IM Newsroom. If you apply for the full service, we will build your homepage under your news organization’s name and domain, and connect your reporter accounts right away.')}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          <a href="/imnewsroom#apply" className="btn-primary py-3 text-[15px]">{t('정식 신청하기', 'Apply for the full service')}</a>
          <SignOutButton />
        </div>
        <p className="mt-5 text-[12.5px] text-muted">{t('체험 계정은 끝난 날부터 30일 뒤 자동으로 지워집니다.', 'Trial accounts are deleted automatically 30 days after the trial ends.')}</p>
      </div>
    </div>
  )
}
