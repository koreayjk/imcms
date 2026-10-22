import type { CSSProperties } from 'react'
import type { SiteConfig } from '@/lib/sites'

// 오픈 준비 중인 매체의 도메인에 들어온 방문자에게 보여 주는 안내 화면 (홈페이지 설정의 "오픈 준비 중" 스위치)
export default function ComingSoon({ site }: { site: SiteConfig }) {
  const en = site.lang === 'en'
  const email = site.legal?.email
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center bg-white px-6 text-center"
      style={{ '--brand': site.colors.brand } as CSSProperties}
      lang={en ? 'en' : 'ko'}
    >
      <p className="text-[13px] font-semibold tracking-[0.12em] text-[color:var(--brand)]">{en ? 'COMING SOON' : 'COMING SOON'}</p>
      <h1 className="mt-4 text-[34px] font-extrabold tracking-[-0.03em] text-[#14171C] sm:text-[44px]">{site.name}</h1>
      {site.slogan && <p className="mt-3 text-[15px] text-[#5B616B]">{site.slogan}</p>}
      <p className="mt-8 text-[17px] font-semibold text-[#14171C]">{en ? 'We are getting ready to open.' : '오픈 준비 중입니다.'}</p>
      <p className="mt-2 max-w-[28em] text-[14.5px] leading-[1.8] text-[#5B616B]">
        {en ? 'The site will open soon. Thank you for your patience.' : '곧 찾아뵙겠습니다. 조금만 기다려 주세요.'}
      </p>
      {email && <p className="mt-6 text-[13px] text-[#8C929B]">{en ? 'Contact' : '문의'}: {email}</p>}
    </div>
  )
}
