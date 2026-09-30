import Link from 'next/link'
import { ISSUER, PRODUCT } from '@/lib/product'

const GUIDES = [
  { title: '기사 쓰고 발행하기', body: '기사쓰기 → 저장(작성중) → 승인신청 → 편집장이 확인 후 발행. 편집장은 “바로 발행”도 할 수 있습니다.', href: '/articles/new', cta: '기사쓰기' },
  { title: '보도자료로 기사 만들기', body: '보도자료함에서 자료를 열고 “원문 그대로” 또는 “AI 초안”을 누르면 기사 초안이 만들어집니다. 발행 전 원문과 꼭 대조하세요.', href: '/press', cta: '보도자료함' },
  { title: '내 메일로 온 보도자료 받기', body: '지메일 필터로 보도자료만 전용 주소로 전달하면 보도자료함에 자동으로 들어옵니다.', href: '/press/email', cta: '메일로 받기 설정' },
  { title: '홈페이지 첫 화면 배치', body: '편집장은 홈편집에서 헤드라인·톱·주요 기사 자리를 직접 정합니다.', href: '/admin/home', cta: '홈편집' },
  { title: '기자명·내 이름 바꾸기', body: '기사마다 기자명을 따로 적을 수 있고, 내 정보에서 회원 이름을 바꿀 수 있습니다.', href: '/account', cta: '내 정보' },
  { title: '여러 매체에 함께 송고', body: '기사 편집 화면 아래 “함께 송고할 매체”를 고르고 발행하면 다른 매체에도 올라갑니다.', href: '/articles', cta: '기사목록' },
]

const FAQ = [
  { q: '요청한 일은 언제 처리되나요?', a: '업무요청은 영업일 기준 순서대로 확인합니다. 오류·장애는 먼저 처리합니다. 답변이 달리면 고객센터 홈과 업무요청 목록에 “새 답변”이 표시됩니다.' },
  { q: '기자 계정은 어떻게 늘리나요?', a: '새 기자가 로그인 화면에서 회원가입(구글 계정 가능)을 하면, 관리자 승인 후 바로 쓸 수 있습니다.' },
  { q: '청구서와 세금계산서는 어디서 보나요?', a: '편집장 이상 계정으로 고객센터 → 청구서에서 월별로 보고 PDF로 저장할 수 있습니다. 세금계산서 받을 담당자는 결제 정보에 적어 주세요.' },
  { q: '비밀번호를 잊었어요.', a: '업무요청으로 알려주시면 재설정 방법을 안내해 드립니다. 구글로 가입했다면 구글 로그인을 쓰면 됩니다.' },
  { q: '업무요청에 비밀번호를 적어도 되나요?', a: '적지 마세요. 계정 정보가 꼭 필요하면 요청에 “전화로 알려드리겠다”고 남겨 주시면 연락드립니다.' },
]

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-[1000px] px-4 py-6 md:px-8 md:py-10">
      <h1 className="text-[22px] font-extrabold tracking-tight">이용안내</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {GUIDES.map((g) => (
          <div key={g.title} className="flex flex-col rounded-2xl bg-white p-6 ring-1 ring-black/5">
            <p className="text-[16px] font-bold">{g.title}</p>
            <p className="mt-2 flex-1 text-[14px] leading-relaxed text-[#3B4048]">{g.body}</p>
            <Link href={g.href} className="mt-4 w-fit text-[13.5px] font-semibold text-[#2F6BF0] hover:underline">{g.cta} →</Link>
          </div>
        ))}
      </div>

      <h2 className="mt-12 text-[18px] font-extrabold">자주 묻는 질문</h2>
      <div className="mt-4 space-y-2">
        {FAQ.map((f) => (
          <details key={f.q} className="group rounded-xl bg-white px-5 py-4 ring-1 ring-black/5">
            <summary className="flex cursor-pointer list-none items-center justify-between text-[15px] font-semibold [&::-webkit-details-marker]:hidden">
              <span><span className="mr-2 text-[#E5483A]">Q.</span>{f.q}</span>
              <span className="text-muted transition-transform group-open:rotate-45" aria-hidden>+</span>
            </summary>
            <p className="mt-2 pl-6 text-[14px] leading-relaxed text-[#3B4048]">{f.a}</p>
          </details>
        ))}
      </div>

      <section id="contact" className="mt-12 scroll-mt-6 rounded-2xl bg-[#0B1020] p-8 text-white">
        <h2 className="text-[18px] font-extrabold">{PRODUCT.name} 운영팀 연락처</h2>
        <div className="mt-4 grid gap-4 text-[14px] sm:grid-cols-2">
          <div>
            <p className="text-white/60">가장 빠른 방법</p>
            <Link href="/support/tickets/new" className="mt-1 inline-block rounded-full bg-[#2F6BF0] px-5 py-2 font-bold">업무요청 쓰기</Link>
          </div>
          <div>
            <p className="text-white/60">전화 · 이메일</p>
            <p className="mt-1">{ISSUER.contact ?? '운영팀 연락처는 곧 안내합니다.'}</p>
          </div>
        </div>
      </section>
    </div>
  )
}
