import type { Metadata } from 'next'
import { gdpaBase } from '@/lib/gdpa-server'
import SubPage from '@/components/gdpa/SubPage'

export const metadata: Metadata = { title: '자주 묻는 질문' }

const FAQ: [string, string][] = [
  ['회원가입은 누구나 할 수 있나요?', '만 14세 이상이면 누구나 가입 신청을 할 수 있습니다. 사무국이 신청 내용을 확인한 뒤 승인하면 회원 서비스를 이용할 수 있습니다.'],
  ['개인회원과 회원사(언론사) 회원은 무엇이 다른가요?', '개인회원은 협회 소식과 행사·교육 안내를 받는 회원입니다. 회원사 회원은 언론사가 협회에 입회하는 것으로, 입회 서류 제출과 이사회 심사를 거칩니다.'],
  ['회원사가 되면 어떤 혜택이 있나요?', '협회 홈페이지에 회원사 소개와 기사가 실리고, 기사 교류·공동 기획, 기자 교육, 기술 지원 등을 받을 수 있습니다. 자세한 내용은 “회원 혜택”을 참고해 주세요.'],
  ['입회비와 연회비는 얼마인가요?', '창립총회에서 정해지면 공지사항으로 안내합니다.'],
  ['비밀번호를 잊어버렸어요.', '로그인 화면의 “비밀번호 재설정”을 누르고 가입한 이메일을 넣으면 재설정 메일을 보내 드립니다.'],
  ['탈퇴는 어떻게 하나요?', '“내 정보”에서 탈퇴를 요청하거나 사무국에 연락하시면 바로 처리합니다. 탈퇴하면 개인정보는 지체 없이 파기합니다.'],
]

export default async function Faq() {
  return (
    <SubPage base={(await gdpaBase())} section="/notice" current="/faq" title="자주 묻는 질문">
      <ul className="divide-y divide-[var(--g-line)] border-y-2 border-[var(--g-navy)]">
        {FAQ.map(([q, a]) => (
          <li key={q}>
            <details className="group px-2 py-4">
              <summary className="flex cursor-pointer list-none items-center gap-3 text-[16.5px] font-bold">
                <span className="text-[var(--g-gold-ink)]">Q</span>{q}
                <span aria-hidden className="ml-auto text-[var(--g-sub)] transition group-open:rotate-180">⌄</span>
              </summary>
              <p className="mt-3 pl-7 text-[15.5px] leading-[1.8] text-[var(--g-sub)]">{a}</p>
            </details>
          </li>
        ))}
      </ul>
    </SubPage>
  )
}
