import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { PRODUCT, isProductHost } from '@/lib/product'
import Link from 'next/link'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import TrialSignupForm from '@/components/auth/TrialSignupForm'
import { isApproved } from '@/lib/cms'

// 제품 도메인(imnewsroom.com)으로 들어온 경우에만 검색에 노출한다
export function generateMetadata(): Metadata {
  const indexable = PRODUCT.indexable && isProductHost(headers().get('host'))
  return {
    title: '1주일 무료 체험 | IM 뉴스룸',
    description: '샘플 기사가 채워진 체험용 신문에서 기자·편집장·그룹장 역할을 바꿔 가며 IM 뉴스룸을 7일 동안 무료로 써 보세요.',
    robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: { type: 'website', siteName: PRODUCT.name, title: '1주일 무료 체험 | IM 뉴스룸', description: '카드 등록 없이 7일 동안 IM 뉴스룸을 우리 신문처럼 써 보세요.', locale: 'ko_KR', images: [{ url: PRODUCT.ogImage, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', images: [PRODUCT.ogImage] },
    ...(indexable ? { alternates: { canonical: `${PRODUCT.url}/trial` } } : {}),
  }
}

const TRY = [
  ['기자', '기사 쓰기, 보도자료로 AI 초안 만들기, AI 법적 검수, 사진 넣기, 승인신청'],
  ['편집장', '승인신청된 기사 승인·반려·발행, 홈 편집판으로 첫 화면 배치, 광고·팝업, 뉴스레터 미리보기'],
  ['그룹장', '여러 매체를 묶는 그룹 관리, 회원 관리·AI 사용량 화면 둘러보기'],
]
const RULES = [
  '체험 기간은 가입한 때부터 7일입니다. 카드 등록이나 결제는 없습니다.',
  '체험하는 분들이 모두 같은 체험용 신문 ‘IM 체험뉴스’를 함께 씁니다.',
  '샘플 기사(🔒)는 수정·삭제할 수 없고, 기사는 내가 쓴 것만 지울 수 있습니다.',
  'AI 초안·검수는 1인 30회까지 써 볼 수 있습니다.',
  '체험 중 쓴 기사는 7일 뒤 자동으로 지워집니다. 연습용으로 써 주세요.',
]

export default async function TrialPage() {
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
      <div className="mx-auto grid max-w-[1080px] gap-10 px-4 py-12 md:grid-cols-[1fr_440px] md:py-16">
        <div>
          <p className="text-[12.5px] font-bold tracking-[0.2em] text-muted">IM NEWSROOM · FREE TRIAL</p>
          <h1 className="mt-3 text-[30px] font-extrabold leading-[1.3] tracking-[-0.03em] md:text-[38px]">7일 동안 무료로<br />우리 신문처럼 써 보세요</h1>
          <p className="mt-4 text-[15.5px] leading-[1.8] text-muted">
            샘플 기사가 채워진 체험용 신문에서 기자 · 편집장 · 그룹장 역할을 바꿔 가며 IM 뉴스룸의 모든 화면을 직접 써 볼 수 있습니다.
          </p>
          <a href={demo} target="_blank" rel="noopener" className="mt-5 inline-block text-[14px] font-semibold underline underline-offset-4">체험용 신문 홈페이지 먼저 보기 ↗</a>

          <h2 className="mt-10 text-[16px] font-bold">역할마다 써 볼 수 있는 것</h2>
          <ul className="mt-3 space-y-2.5">
            {TRY.map(([r, d]) => (
              <li key={r} className="flex gap-3 rounded-lg border border-line bg-white p-4">
                <span className="w-14 shrink-0 font-bold">{r}</span>
                <span className="text-[14px] leading-[1.7] text-muted">{d}</span>
              </li>
            ))}
          </ul>
          <h2 className="mt-8 text-[16px] font-bold">체험 안내</h2>
          <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[14px] leading-[1.7] text-muted">
            {RULES.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>

        <div>
          {unfinished ? (
            <div className="rounded-lg border border-line bg-white p-6 text-center">
              <p className="font-bold">체험 계정 만들기를 마쳐 주세요</p>
              <p className="mt-2 text-[14px] text-muted">소속 언론사와 연락처를 적으면 바로 체험을 시작합니다.</p>
              <Link href="/trial/complete" className="btn-primary mt-4 inline-block">이어서 하기</Link>
            </div>
          ) : loggedIn ? (
            <div className="rounded-lg border border-line bg-white p-6 text-center">
              <p className="font-bold">이미 로그인돼 있습니다</p>
              <p className="mt-2 text-[14px] text-muted">체험 계정이면 편집국에서 바로 이어서 쓰면 됩니다.</p>
              <Link href="/newsroom" className="btn-primary mt-4 inline-block">편집국으로</Link>
            </div>
          ) : (
            <>
              <TrialSignupForm />
              <p className="mt-4 text-center text-[13px] text-muted">이미 체험 계정이 있으신가요? <Link href="/login" className="font-semibold text-ink underline underline-offset-2">로그인</Link></p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
