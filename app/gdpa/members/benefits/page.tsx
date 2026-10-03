import type { Metadata } from 'next'
import { gdpaBase } from '@/lib/gdpa-server'
import SubPage from '@/components/gdpa/SubPage'

export const metadata: Metadata = { title: '회원 혜택' }

const BENEFITS = [
  ['협회 회원사 인증', '협회 회원사임을 홈페이지에 표시하고, 회원사 소개와 기사가 협회 홈페이지에 실립니다.'],
  ['기사 교류·공동 기획', '회원사 간 기사 교류와 공동 기획 취재로 보도의 폭을 넓힙니다.'],
  ['기자 교육', '디지털 취재, AI 활용, 언론 법률·윤리 교육과 세미나에 참여할 수 있습니다.'],
  ['디지털 기술 지원', '기사 관리 시스템(IM 뉴스룸), 홈페이지 제작, 검색 노출 등 기술 지원을 받을 수 있습니다.'],
  ['법률·분쟁 상담', '언론 분쟁·정정보도 대응에 관한 기본 상담과 자료를 제공합니다.'],
  ['시상·행사', '협회 언론상 등 시상과 회원사 행사에 참여할 수 있습니다.'],
]

export default function Benefits() {
  return (
    <SubPage base={gdpaBase()} section="/members" current="/members/benefits" title="회원 혜택">
      <ul className="grid gap-5 sm:grid-cols-2">
        {BENEFITS.map(([t, d], i) => (
          <li key={t} className="rounded-lg border border-[var(--g-line)] p-6">
            <p className="text-[13px] font-bold text-[var(--g-gold-ink)]">혜택 {i + 1}</p>
            <p className="mt-1 text-[18px] font-bold">{t}</p>
            <p className="mt-2 text-[15px] leading-[1.75] text-[var(--g-sub)]">{d}</p>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-[14px] text-[var(--g-sub)]">혜택의 구체적인 내용과 조건은 협회 규정에 따르며, 바뀌면 공지사항으로 알려 드립니다.</p>
    </SubPage>
  )
}
