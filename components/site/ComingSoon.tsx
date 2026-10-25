import type { CSSProperties } from 'react'
import type { SiteConfig } from '@/lib/sites'
import { formatZonedParts, isOpenZone } from '@/lib/zoned-time'
import OpenCountdown from './OpenCountdown'

// 오픈 준비 중인 매체의 도메인에 들어온 방문자에게 보여 주는 안내 화면 (홈페이지 설정의 "오픈 준비 중" 스위치)
//   매체 대표색 바탕에 로고·오픈 예정 일시·카운트다운을 보여 주고, 아래에 "오픈 준비 중" 공사 띠를 흘려 보낸다
export default function ComingSoon({ site }: { site: SiteConfig }) {
  const en = site.lang === 'en'
  const email = site.legal?.email
  const openText = site.openAt && Number.isFinite(Date.parse(site.openAt)) && Date.parse(site.openAt) > Date.now() ? formatZonedParts(site.openAt, isOpenZone(site.openTz) ? site.openTz : 'Asia/Seoul', en ? 'en' : 'ko') : null
  const label = en ? 'GETTING READY TO OPEN' : '오픈 준비 중'
  const tape = Array.from({ length: 10 }, () => `${label}  ✦  COMING SOON  ✦  `).join('')
  const vars = { '--brand': site.colors.brand, '--brand-dark': site.colors.brandDark, '--gold': site.colors.gold } as CSSProperties
  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16 text-center text-white"
      style={{ ...vars, background: 'radial-gradient(120% 90% at 50% 0%, color-mix(in srgb, var(--brand) 82%, white) 0%, var(--brand) 45%, var(--brand-dark) 100%)' }}
      lang={en ? 'en' : 'ko'}
    >
      <style>{`@keyframes cs-tape{from{transform:translateX(0)}to{transform:translateX(-50%)}}@keyframes cs-pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.7)}}@media (prefers-reduced-motion:reduce){.cs-anim{animation:none!important}}`}</style>
      {/* 은은한 격자 무늬 */}
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)', backgroundSize: '44px 44px' }} />

      <div className="relative z-10 flex w-full max-w-[640px] flex-col items-center">
        {site.logoMark && site.logoMode !== 'text' ? (
          <div className="rounded-2xl bg-white px-6 py-4 shadow-[0_10px_40px_rgba(0,0,0,.25)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={site.logoMark} alt={site.name} className="h-14 w-auto max-w-[260px] object-contain sm:h-16" />
          </div>
        ) : null}

        <p className="mt-7 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-[13px] font-bold tracking-[0.14em] backdrop-blur">
          <span className="cs-anim inline-block h-2.5 w-2.5 rounded-full bg-[color:var(--gold)]" style={{ animation: 'cs-pulse 1.6s ease-in-out infinite' }} aria-hidden />
          {en ? 'COMING SOON' : '오픈 준비 중'}
        </p>

        <h1 className="mt-5 text-[40px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[56px]">{site.name}</h1>
        {site.slogan && <p className="mt-3 text-[16px] font-medium text-white/80 sm:text-[18px]">{site.slogan}</p>}

        {openText ? (
          <>
            <p className="mt-9 text-[13px] font-semibold tracking-[0.16em] text-white/70">{en ? 'OPENING' : '오픈 예정'}</p>
            <p className="mt-1 text-[24px] font-extrabold text-[color:var(--gold)] sm:text-[30px]">{openText.date}</p>
            <p className="mt-0.5 text-[13px] font-semibold text-white/70">{openText.zone}</p>
            {site.openAt && <OpenCountdown openAt={site.openAt} en={en} onDark />}
          </>
        ) : (
          <>
            <p className="mt-9 text-[19px] font-bold">{en ? 'We are getting ready to open.' : '더 좋은 모습으로 곧 찾아뵙겠습니다.'}</p>
            <p className="mt-2 max-w-[28em] text-[14.5px] leading-[1.8] text-white/75">{en ? 'The site will open soon. Thank you for your patience.' : '조금만 기다려 주세요.'}</p>
          </>
        )}

        {email && <p className="mt-10 text-[13px] text-white/60">{en ? 'Contact' : '문의'}: {email}</p>}
      </div>

      {/* 오픈 준비 중 공사 띠 */}
      <div aria-hidden className="absolute inset-x-0 bottom-8 z-0 -rotate-[2deg] overflow-hidden bg-[color:var(--gold)] py-2 shadow-[0_6px_24px_rgba(0,0,0,.25)]">
        <div className="cs-anim flex w-max whitespace-nowrap text-[13px] font-extrabold tracking-[0.2em] text-[color:var(--brand-dark)]" style={{ animation: 'cs-tape 40s linear infinite' }}>
          <span>{tape}</span><span>{tape}</span>
        </div>
      </div>
    </div>
  )
}
