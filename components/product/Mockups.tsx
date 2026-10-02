// 제품 홈페이지용 CMS 화면 모형 (실제 CMS와 같은 구성·색을 줄여서 보여준다)

function Rail({ active }: { active: string }) {
  const items = ['뉴스룸', '기사쓰기', '기사목록', '보도자료', '홈편집']
  return (
    <div className="hidden w-[64px] shrink-0 flex-col items-center gap-1 bg-[#262A33] py-3 text-[10px] text-[#AEB4C0] sm:flex">
      <span className="mb-2 grid h-8 w-8 place-items-center rounded bg-[#1C1F26] text-[10px] font-black text-white">IM</span>
      {items.map((i) => (
        <span key={i} className={`relative w-full py-2.5 text-center ${i === active ? 'bg-white/[0.06] text-[#F2B544]' : ''}`}>
          {i === active && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-[#F2B544]" />}
          {i}
        </span>
      ))}
    </div>
  )
}

function Window({ active, children }: { active: string; children: React.ReactNode }) {
  return (
    <div className="flex overflow-hidden rounded-xl border border-black/10 bg-[#F4F5F7] text-[#14171C] shadow-[0_30px_80px_-25px_rgba(11,16,32,0.45)]">
      <Rail active={active} />
      <div className="min-w-0 flex-1">
        <div className="flex h-11 items-center gap-2 border-b border-[#E4E6EA] bg-white px-4 text-[12px]">
          <strong className="text-[13px]">더케어타임즈</strong>
          <span className="rounded-full border border-[#E4E6EA] px-2 py-px text-[10px] text-[#8C929B]">홈페이지 ↗</span>
          <span className="ml-auto text-[#5B616B]">홍길동 <span className="rounded bg-[#E4E6EA]/70 px-1 text-[10px]">편집장</span></span>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  )
}

const PRESS = [
  { src: '뉴스와이어 · 노인', title: '○○시, 어르신 돌봄 SOS센터 전 지역으로 확대', time: '09:12', used: false, hot: true },
  { src: '정책브리핑', title: '○○부, 장기요양 재가급여 개편안 발표', time: '08:47', used: true },
  { src: '뉴스와이어 · 의료와 병원', title: '○○대병원, 지역 요양병원과 응급 전원 협약 체결', time: '08:30', used: false },
  { src: '직접 등록', title: '한울요양병원, 야간 전담 간호 인력 두 배로 확대', time: '08:05', used: false, manual: true },
  { src: '뉴스와이어 · 사회복지', title: '돌봄 종사자 처우 개선 토론회 개최', time: '07:41', used: false },
]

export function PressInboxMock() {
  return (
    <Window active="보도자료">
      <div className="grid gap-3 lg:grid-cols-[1fr_150px]">
        <div className="overflow-hidden rounded-lg border border-[#E4E6EA] bg-white">
          <div className="flex items-center gap-4 border-b border-[#E4E6EA] px-3.5 text-[12px]">
            <span className="-mb-px border-b-2 border-[#14171C] py-2.5 font-bold">추천 (더케어타임즈 관련)</span>
            <span className="py-2.5 text-[#8C929B]">전체</span>
            <span className="ml-auto rounded bg-[#14171C] px-2 py-1 text-[10.5px] font-semibold text-white">+ 직접 등록</span>
          </div>
          <ul className="divide-y divide-[#E4E6EA]">
            {PRESS.map((r) => (
              <li key={r.title} className="px-3.5 py-2.5">
                <div className="flex items-center gap-1.5 text-[10px] text-[#8C929B]">
                  {r.manual && <span className="rounded bg-[#14171C] px-1 py-px text-white">직접 등록</span>}
                  {!r.manual && <span className="rounded bg-[#E4E6EA]/70 px-1 py-px">{r.src}</span>}
                  <span className="tabular-nums">{r.time}</span>
                  {r.used && <span className="rounded bg-[#1E7D4D]/10 px-1 py-px font-semibold text-[#1E7D4D]">기사화됨</span>}
                  {r.hot && <span className="rounded bg-[#E5483A] px-1 py-px font-semibold text-white">NEW</span>}
                </div>
                <p className="mt-1 truncate text-[12.5px] font-semibold">{r.title}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="hidden space-y-3 lg:block">
          <div className="rounded-lg border border-[#E4E6EA] bg-white p-3">
            <p className="text-[10.5px] font-bold">오늘 뉴스와이어 기사화</p>
            <p className="mt-1 text-[22px] font-bold tabular-nums">2<span className="text-[12px] text-[#8C929B]"> / 5건</span></p>
          </div>
          <div className="rounded-lg border border-[#E4E6EA] bg-white p-3 text-[10.5px]">
            <p className="font-bold">출처별 수집 상태</p>
            {['의료와 병원', '노인', '사회복지', '정책브리핑'].map((s) => (
              <p key={s} className="mt-1.5 flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#1E7D4D]" />{s}</p>
            ))}
          </div>
        </div>
      </div>
    </Window>
  )
}

export function HomeBoardMock() {
  const Slot = ({ label, title, tone, className = '' }: { label: string; title: string; tone: string; className?: string }) => (
    <div className={`flex flex-col justify-between rounded-md border-2 border-dashed bg-white p-2.5 ${tone} ${className}`}>
      <span className="text-[9.5px] font-bold uppercase tracking-wider opacity-80">{label}</span>
      <span className="mt-1.5 line-clamp-2 text-[11.5px] font-semibold text-[#14171C]">{title}</span>
    </div>
  )
  return (
    <Window active="홈편집">
      <div className="mb-3 flex items-center justify-between text-[12px]">
        <strong className="text-[13px]">홈 편집판</strong>
        <span className="rounded bg-[#1E7D4D] px-2.5 py-1 text-[10.5px] font-semibold text-white">홈페이지에 반영</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <Slot label="헤드라인" title="요양병원 간병비 급여화 시범사업, 참여 기관 확대 논의" tone="border-[#E5483A] text-[#E5483A]" className="col-span-2 row-span-2 min-h-[120px]" />
        <Slot label="톱 1" title="대학병원 응급실 운영 현황…야간 전문의 확보가 관건" tone="border-[#F2B544] text-[#9A6B00]" />
        <Slot label="톱 2" title="기초생활보장 부양의무자 기준 완화" tone="border-[#F2B544] text-[#9A6B00]" />
        <Slot label="주요" title="돌봄 로봇·센서 도입 확산" tone="border-[#3B82F6] text-[#2563EB]" />
        <Slot label="주요" title="장기요양 재가서비스 이용 늘어" tone="border-[#3B82F6] text-[#2563EB]" />
      </div>
      <div className="mt-2 grid grid-cols-4 gap-2">
        {['비대면 진료 제도화 논의', '사회서비스원 설립 확대', '요양보호사 처우 개선', '시니어 주거 수요 증가'].map((t) => (
          <Slot key={t} label="추천" title={t} tone="border-[#1E7D4D] text-[#1E7D4D]" />
        ))}
      </div>
    </Window>
  )
}

// 기사 한 건 → 여러 매체로 퍼져나가는 그림
export function SyndicateVisual() {
  const outlets = [
    { name: '더케어타임즈', color: '#02472F', note: '원본' },
    { name: '시니어경제', color: '#1F4E8C', note: '함께 송고' },
    { name: '돌봄뉴스', color: '#8C2F39', note: '함께 송고' },
  ]
  return (
    <div className="relative mx-auto max-w-[520px]">
      <div className="relative z-10 mx-auto w-[78%] rounded-xl bg-white p-4 text-[#14171C] shadow-[0_20px_50px_-15px_rgba(0,0,0,0.5)]">
        <p className="text-[10.5px] font-bold text-[#8C929B]">기사 1건 · 발행</p>
        <p className="mt-1 text-[14px] font-bold leading-snug">장기요양 재가급여 개편…방문요양 이용 늘 듯</p>
        <div className="mt-3 flex flex-wrap gap-1.5 text-[10.5px]">
          {outlets.slice(1).map((o) => (
            <span key={o.name} className="rounded-full border border-[#E4E6EA] px-2 py-0.5">☑ {o.name}</span>
          ))}
        </div>
      </div>
      <svg viewBox="0 0 520 90" className="-my-1 block h-[90px] w-full" aria-hidden>
        {[90, 260, 430].map((x, i) => (
          <path key={x} d={`M260 0 C 260 45, ${x} 45, ${x} 90`} fill="none" stroke="url(#synd)" strokeWidth="2.5" className="pn-dash" style={{ animationDelay: `${i * 200}ms` }} />
        ))}
        <defs>
          <linearGradient id="synd" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#F5B83D" /><stop offset="1" stopColor="#E5483A" /></linearGradient>
        </defs>
      </svg>
      <div className="grid grid-cols-3 gap-2.5">
        {outlets.map((o) => (
          <div key={o.name} className="overflow-hidden rounded-lg bg-white text-[#14171C] shadow-[0_15px_35px_-12px_rgba(0,0,0,0.5)]">
            <div className="px-2.5 py-2 text-[11.5px] font-extrabold text-white" style={{ background: o.color }}>{o.name}</div>
            <div className="space-y-1 p-2.5">
              <span className="block h-1.5 w-full rounded bg-[#E4E6EA]" />
              <span className="block h-1.5 w-4/5 rounded bg-[#E4E6EA]" />
              <span className={`mt-1.5 inline-block rounded px-1.5 py-px text-[9.5px] font-bold ${o.note === '원본' ? 'bg-[#1E7D4D]/10 text-[#1E7D4D]' : 'bg-[#F5B83D]/20 text-[#8A5A00]'}`}>{o.note}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-[11.5px] text-white/60">매체 이름은 예시입니다</p>
    </div>
  )
}

export function ApprovalFlow() {
  const steps = [
    { label: '작성중', color: '#9a8c46' },
    { label: '승인신청', color: '#2d6ca8' },
    { label: '발행', color: '#1e7d4d' },
  ]
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-2">
          <span className="rounded-md px-3 py-1.5 text-[12.5px] font-bold" style={{ background: `${s.color}1A`, color: s.color }}>{s.label}</span>
          {i < steps.length - 1 && <span className="text-[#8C929B]">→</span>}
        </div>
      ))}
    </div>
  )
}

// 기자 메일 → 전용 주소 → 보도자료함으로 흘러가는 그림
export function MailForwardVisual() {
  const Node = ({ title, sub, color, children }: { title: string; sub: string; color: string; children: React.ReactNode }) => (
    <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 text-[#14171C] shadow-[0_12px_30px_-14px_rgba(11,16,32,0.35)] ring-1 ring-black/5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg text-white" style={{ background: color }}>{children}</span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-bold">{title}</span>
        <span className="block truncate text-[11.5px] text-[#5B616B]">{sub}</span>
      </span>
    </div>
  )
  const Arrow = ({ label }: { label: string }) => (
    <div className="flex items-center gap-2 py-1.5 pl-8 text-[11px] font-semibold text-[#8C929B]">
      <svg width="14" height="26" viewBox="0 0 14 26" aria-hidden><path d="M7 0v22M2 17l5 6 5-6" fill="none" stroke="#F5A524" strokeWidth="2" className="pn-dash" /></svg>
      {label}
    </div>
  )
  const mail = <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 6.5 8.5 6 8.5-6" /></svg>
  return (
    <div className="mt-8 max-w-[420px]">
      <Node title="기자 지메일" sub="[보도자료] ○○군, 경로당 냉난방비 지원 확대" color="#EA4335">{mail}</Node>
      <Arrow label="필터: 제목에 ‘보도자료’ → 자동 전달" />
      <Node title="내 전용 주소" sub="press+hong…@imnewsroom" color="#8B5CF6">
        <span className="text-[12px] font-black">IM</span>
      </Node>
      <Arrow label="보낸 기관·제목 자동 정리, 사진 첨부 저장" />
      <Node title="보도자료함" sub="메일 · ○○군청 기획홍보실 · 방금" color="#10B981">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden><path d="M3 13h5l1.5 3h5L16 13h5M5.5 5h13L21 13v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-5l2.5-8Z" /></svg>
      </Node>
    </div>
  )
}

// 고객센터 화면 모형: 업무요청 카드와 답변
export function SupportMock() {
  const tickets = [
    { s: '완료', cls: 'bg-[#E4E6EA] text-[#5B616B]', cat: '디자인', title: '메인 상단 배너 자리를 만들어 주세요' },
    { s: '진행', cls: 'bg-[#2d6ca8]/10 text-[#2d6ca8]', cat: '기능·개발', title: '기사 목록에 조회수 정렬을 추가해 주세요', reply: true },
    { s: '접수', cls: 'bg-[#E5483A]/10 text-[#E5483A]', cat: '오류·장애', title: '사진 설명이 모바일에서 잘려 보입니다' },
  ]
  return (
    <div className="overflow-hidden rounded-xl border border-black/10 bg-[#F4F5F7] text-[#14171C] shadow-[0_30px_80px_-25px_rgba(11,16,32,0.45)]">
      <div className="flex items-center gap-5 border-b border-[#E4E6EA] bg-white px-5 text-[12.5px]">
        <strong className="py-3 text-[13.5px]">고객센터</strong>
        {['업무요청', '공지', '청구서', '결제 정보'].map((t, i) => (
          <span key={t} className={`py-3 ${i === 0 ? '-mb-px border-b-2 border-[#E5483A] font-bold' : 'text-[#8C929B]'}`}>{t}</span>
        ))}
      </div>
      <div className="grid gap-2.5 p-4 sm:grid-cols-3">
        {tickets.map((t) => (
          <div key={t.title} className="flex flex-col sm:min-h-[112px] rounded-xl bg-white p-3 shadow-[0_6px_18px_-12px_rgba(11,16,32,0.35)]">
            <div className="flex items-center gap-1 text-[10px]">
              <span className={`rounded px-1.5 py-px font-bold ${t.cls}`}>{t.s}</span>
              <span className="text-[#8C929B]">{t.cat}</span>
              {t.reply && <span className="ml-auto rounded bg-[#E5483A] px-1 py-px font-bold text-white">새 답변</span>}
            </div>
            <p className="mt-2 text-[12.5px] font-bold leading-snug">{t.title}</p>
          </div>
        ))}
      </div>
      <div className="mx-4 mb-4 rounded-xl bg-[#EEF2F8] p-3.5">
        <p className="flex items-center gap-2 text-[11.5px]">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-[#F5B83D] to-[#E5483A] text-[9px] font-bold text-white">IM</span>
          <strong>IM 뉴스룸 운영팀</strong>
          <span className="ml-auto text-[#8C929B]">방금</span>
        </p>
        <p className="mt-2 rounded-lg bg-white px-3 py-2 text-[12px] leading-relaxed">요청하신 조회수 정렬을 기사목록에 추가했습니다. 확인 부탁드립니다.</p>
      </div>
      <div className="flex items-center justify-between border-t border-[#E4E6EA] bg-white px-5 py-3 text-[12px]">
        <span className="font-bold">2026년 10월 청구서</span>
        <span className="flex items-center gap-2"><span className="rounded bg-[#1E7D4D]/10 px-1.5 py-px text-[10.5px] font-bold text-[#1E7D4D]">납부 완료</span><span className="rounded border border-[#E4E6EA] px-2 py-0.5 text-[10.5px]">PDF 저장</span></span>
      </div>
    </div>
  )
}

// 그룹·권한: 한 사람이 여러 매체에서 다른 직급을 갖고, 상단바에서 매체를 바꾼다
export function TeamMock() {
  const people = [
    { name: '김발행', tag: '발행인', tagCls: 'bg-[#F5A524] text-[#3B2A00]', roles: [['그룹 전체 매체', '관리']] },
    { name: '이편집', tag: '매체별 직급', tagCls: 'bg-[#6366F1]/10 text-[#4F46E5]', roles: [['케어타임즈', '편집장'], ['시니어경제', '기자']] },
    { name: '박기자', tag: '매체별 직급', tagCls: 'bg-[#6366F1]/10 text-[#4F46E5]', roles: [['시니어경제', '기자']] },
  ]
  return (
    <div className="overflow-hidden rounded-xl border border-black/10 bg-[#F4F5F7] text-[#14171C] shadow-[0_30px_80px_-25px_rgba(11,16,32,0.45)]">
      <div className="flex items-center gap-3 border-b border-[#E4E6EA] bg-white px-5 py-3 text-[12.5px]">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-[#1C1F26] text-[10px] font-extrabold text-white">IM</span>
        <span className="rounded border border-[#E4E6EA] px-2.5 py-1 font-bold">케어타임즈 (편집장) ▾</span>
        <span className="ml-auto text-[11px] text-[#8C929B]">매체를 바꾸면 그 매체의 직급으로</span>
      </div>
      <div className="space-y-2.5 p-4">
        {people.map((p) => (
          <div key={p.name} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-white p-3 shadow-[0_6px_18px_-12px_rgba(11,16,32,0.35)]">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#EEF2F8] text-[12px] font-bold">{p.name[0]}</span>
            <span className="text-[13px] font-bold">{p.name}</span>
            <span className={`rounded px-1.5 py-px text-[10.5px] font-bold ${p.tagCls}`}>{p.tag}</span>
            <span className="ml-auto flex flex-wrap gap-1.5">
              {p.roles.map(([o, r]) => (
                <span key={o} className="rounded-full border border-[#E4E6EA] px-2.5 py-1 text-[11px]">{o} · <strong>{r}</strong></span>
              ))}
            </span>
          </div>
        ))}
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-[#F5A524]/60 bg-[#FFF8EA] p-3 text-[12px]">
          <span className="rounded bg-[#E5483A] px-1.5 py-px text-[10px] font-bold text-white">가입 신청</span>
          <span>최신입 · <strong>케어타임즈</strong> 기자로 가입</span>
          <span className="ml-auto rounded bg-[#10B981] px-2 py-0.5 text-[11px] font-bold text-white">발행인 승인</span>
        </div>
      </div>
    </div>
  )
}
