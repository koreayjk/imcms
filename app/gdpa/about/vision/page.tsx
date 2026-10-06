import type { Metadata } from 'next'
import { gdpaBase } from '@/lib/gdpa-server'
import SubPage from '@/components/gdpa/SubPage'

export const metadata: Metadata = { title: '설립 목적·비전' }

const GOALS = [
  ['신뢰', '사실 확인과 정정 보도 원칙을 지키는 윤리 기준으로 독자의 신뢰를 얻습니다.'],
  ['협력', '회원사 간 기사 교류·공동 취재·기술 공유로 작은 언론사도 함께 성장합니다.'],
  ['전문성', '분야별 전문 매체의 깊이 있는 보도를 지원하고 기자 교육을 이어 갑니다.'],
  ['혁신', 'AI·데이터 등 새 기술을 책임 있게 활용하는 디지털 저널리즘을 만들어 갑니다.'],
]

export default async function Vision() {
  return (
    <SubPage base={(await gdpaBase())} section="/about" current="/about/vision" title="설립 목적·비전">
      <section>
        <h2 className="text-[20px] font-bold text-[var(--g-navy)]">설립 목적</h2>
        <p className="mt-3 text-[16.5px] leading-[1.9]">협회는 디지털 언론사와 언론인이 서로 협력하여 언론의 자유와 책임을 함께 지키고, 건전한 디지털 언론 문화를 만들어 공공의 이익에 이바지하는 것을 목적으로 합니다.</p>
      </section>
      <section className="mt-12">
        <h2 className="text-[20px] font-bold text-[var(--g-navy)]">비전</h2>
        <p className="mt-3 rounded-lg bg-[var(--g-navy)] px-6 py-5 text-[19px] font-bold leading-[1.6] text-white">신뢰받는 디지털 저널리즘, 함께 성장하는 언론 공동체</p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {GOALS.map(([t, d]) => (
            <li key={t} className="rounded-lg border border-[var(--g-line)] p-5">
              <p className="text-[18px] font-extrabold text-[var(--g-gold-ink)]">{t}</p>
              <p className="mt-1.5 text-[15px] leading-[1.75] text-[var(--g-sub)]">{d}</p>
            </li>
          ))}
        </ul>
      </section>
      <section className="mt-12">
        <h2 className="text-[20px] font-bold text-[var(--g-navy)]">주요 사업</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[16px] leading-[1.8]">
          <li>언론 윤리강령·자율 규약 제정과 운영</li>
          <li>회원사 기사 교류, 공동 기획 취재, 콘텐츠 협력</li>
          <li>기자·편집자 교육(디지털 취재, AI 활용, 언론 법률)과 세미나</li>
          <li>회원사 기술 지원(기사 관리 시스템, 홈페이지, 검색 노출)</li>
          <li>언론상·시상 등 우수 보도 격려</li>
          <li>회원사·언론인 권익 보호와 제도 개선 제안</li>
        </ul>
      </section>
    </SubPage>
  )
}
