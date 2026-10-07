// 소개 페이지 보안 섹션의 화면 그림 (실제 화면을 단순하게 옮긴 것. 숫자·IP는 예시)

// 2단계 인증: 편집국 코드 입력 화면 + 휴대폰 인증 앱
export function MfaMock() {
  const code = ['4', '8', '2', '9', '1', '3']
  return (
    <div className="relative mx-auto w-full max-w-[520px] pb-16">
      <style>{`
        @keyframes pn-otp { from { stroke-dashoffset: 0 } to { stroke-dashoffset: 62.8 } }
        .pn-otp-ring { animation: pn-otp 30s linear infinite }
        @media (prefers-reduced-motion: reduce) { .pn-otp-ring { animation: none; stroke-dashoffset: 20 } }
      `}</style>

      {/* 편집국 로그인 2단계 화면 */}
      <div className="w-[70%] overflow-hidden rounded-xl bg-white text-[#0F1115] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)] sm:w-[78%]">
        <div className="flex items-center gap-2 border-b border-[#E4E6EA] bg-[#F4F5F7] px-3.5 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
          <span className="ml-3 flex-1 truncate rounded-md bg-white px-3 py-1 text-[11px] text-[#8C929B]">🔒 app.imnewsroom.com/login/mfa</span>
        </div>
        <div className="px-4 pb-6 pt-5 sm:px-6 sm:pb-7 sm:pt-6">
          <p className="text-[12px] font-semibold text-[#8C929B]">IM 뉴스룸 편집국 · 2단계 인증</p>
          <p className="mt-2 text-[16px] font-bold leading-snug">인증 앱의 6자리 코드를<br />넣어 주세요</p>
          <div className="mt-4 flex gap-1 sm:gap-1.5" aria-label="입력한 코드 482913">
            {code.map((d, i) => (
              <span key={i} className={`grid h-8 w-[22px] place-items-center rounded-md border text-[14px] font-bold tabular-nums sm:h-10 sm:w-8 sm:text-[18px] ${i === 3 ? 'ml-1 sm:ml-1.5' : ''} ${i < 5 ? 'border-[#C9D3E3] bg-[#F5F8FC]' : 'border-[#1D3461] bg-white'}`}>{i < 5 ? d : <span className="h-5 w-[2px] bg-[#1D3461]" />}</span>
            ))}
          </div>
          <span className="mt-4 block w-full rounded-md bg-[#1D3461] py-2.5 text-center text-[13.5px] font-semibold text-white">확인</span>
          <p className="mt-3 text-[11.5px] text-[#8C929B]">이 기기는 90일 동안 다시 묻지 않습니다</p>
        </div>
      </div>

      {/* 휴대폰 인증 앱 */}
      <div className="absolute bottom-4 right-0 w-[40%] max-w-[220px] sm:w-[46%] rounded-[2rem] bg-[#0B0E14] p-[6px] shadow-[0_30px_70px_-15px_rgba(0,0,0,0.7)] ring-1 ring-white/15 ">
        <div className="relative overflow-hidden rounded-[1.65rem] bg-[#F6F7F9] pb-5 text-[#0F1115]">
          <span className="absolute left-1/2 top-2 h-[14px] w-[56px] -translate-x-1/2 rounded-full bg-[#0B0E14]" aria-hidden />
          <p className="bg-white px-4 pb-2.5 pt-8 text-[12px] font-bold">인증 앱</p>
          <div className="mx-2 mt-2.5 rounded-lg bg-white px-2.5 py-2.5 sm:mx-2.5 sm:px-3 sm:py-3 shadow-sm ring-1 ring-[#2F6BF0]/40">
            <p className="text-[10.5px] font-semibold text-[#5B616B]">IM Newsroom</p>
            <p className="text-[9.5px] text-[#8C929B]">editor@신문.com</p>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="whitespace-nowrap text-[16px] font-bold tracking-[0.04em] text-[#2F6BF0] tabular-nums sm:text-[22px] sm:tracking-[0.06em]">482 913</span>
              <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 -rotate-90 sm:h-5 sm:w-5" aria-hidden>
                <circle cx="12" cy="12" r="10" fill="none" stroke="#E4E6EA" strokeWidth="3" />
                <circle cx="12" cy="12" r="10" fill="none" stroke="#2F6BF0" strokeWidth="3" strokeDasharray="62.8" className="pn-otp-ring" />
              </svg>
            </div>
          </div>
          <div className="mx-2.5 mt-2 rounded-lg bg-white px-3 py-2.5 opacity-60">
            <p className="text-[10.5px] font-semibold text-[#5B616B]">Google</p>
            <span className="whitespace-nowrap text-[13px] font-bold tracking-[0.04em] text-[#8C929B] tabular-nums sm:text-[15px]">105 774</span>
          </div>
          <p className="mt-3 px-3 text-center text-[9.5px] leading-snug text-[#8C929B]">숫자는 30초마다 바뀝니다</p>
        </div>
      </div>

      {/* 보고 그대로 넣기 */}
      <p className="absolute bottom-0 left-0 flex items-center gap-1.5 rounded-full bg-[#FFD166] px-3 py-1 text-[12px] font-bold text-[#3A2A00] shadow-lg">
        <span aria-hidden>↖</span> 휴대폰 숫자를 보고 그대로 입력
      </p>
    </div>
  )
}

// 로그인 기록: 내 정보 화면 (모르는 기기 한 줄이 눈에 띄게)
export function LoginHistoryMock() {
  const rows = [
    { at: '10.07 09:12', device: 'Windows · Chrome', ip: '211.234.•.•', state: 'here' },
    { at: '10.06 22:40', device: 'iPhone · Safari', ip: '39.7.•.•', state: 'on' },
    { at: '10.05 03:17', device: 'Linux · Firefox', ip: '185.220.•.•', state: 'strange' },
    { at: '09.28 14:05', device: 'Mac · Safari', ip: '121.135.•.•', state: 'off' },
  ] as const
  return (
    <div className="relative mx-auto w-full max-w-[560px]">
      <div className="overflow-hidden rounded-xl bg-white text-[#0F1115] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)]">
        <div className="border-b border-[#E4E6EA] px-5 py-3.5">
          <p className="text-[12px] font-semibold text-[#8C929B]">편집국 · 내 정보</p>
          <p className="mt-0.5 text-[15px] font-bold">로그인 기록</p>
        </div>
        <ul className="divide-y divide-[#EEF0F3] text-[12.5px]">
          {rows.map((r) => (
            <li key={r.at} className={`flex items-center gap-3 px-5 py-2.5 ${r.state === 'strange' ? 'bg-[#FFF1EF]' : ''}`}>
              <span className="w-[74px] shrink-0 tabular-nums text-[#5B616B]">{r.at}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{r.device}</span>
                <span className="block font-mono text-[11px] text-[#8C929B]">{r.ip}</span>
              </span>
              {r.state === 'here' && <span className="shrink-0 rounded bg-[#2F6BF0]/10 px-1.5 py-0.5 text-[11px] font-bold text-[#2F6BF0]">지금 이 기기</span>}
              {r.state === 'on' && <span className="shrink-0 rounded bg-[#1F9D6B]/10 px-1.5 py-0.5 text-[11px] font-bold text-[#1F9D6B]">로그인 중</span>}
              {r.state === 'strange' && <span className="shrink-0 rounded bg-[#E5483A] px-1.5 py-0.5 text-[11px] font-bold text-white">로그인 중 · 모르는 기기?</span>}
              {r.state === 'off' && <span className="shrink-0 text-[11px] text-[#8C929B]">끝남</span>}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3 border-t border-[#E4E6EA] px-5 py-3.5">
          <span className="rounded-md border border-[#E5483A] px-3 py-1.5 text-[12.5px] font-bold text-[#E5483A]">다른 기기 모두 로그아웃</span>
          <span className="text-[11.5px] text-[#5B616B]">누르면 지금 이 기기만 남고 모두 끊깁니다</span>
        </div>
      </div>
    </div>
  )
}
