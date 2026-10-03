import type { Metadata } from 'next'
import { GDPA } from '@/lib/gdpa'
import { gdpaBase } from '@/lib/gdpa-server'
import SubPage from '@/components/gdpa/SubPage'

export const metadata: Metadata = { title: '인사말' }

export default function Greeting() {
  return (
    <SubPage base={gdpaBase()} section="/about" current="/about" title="인사말">
      <div className="grid gap-10 md:grid-cols-[220px_1fr]">
        <div className="flex items-start justify-center md:justify-start"><img src="/gdpa/logo-mark.svg" alt="" className="h-[150px] w-[150px]" /></div>
        <div className="space-y-5 text-[16.5px] leading-[1.95]">
          <p className="text-[22px] font-bold leading-[1.5] text-[var(--g-navy)]">“디지털 시대, 신뢰받는 저널리즘을 함께 만들겠습니다.”</p>
          <p>안녕하십니까. {GDPA.name}({GDPA.short}) 홈페이지를 찾아 주셔서 감사합니다.</p>
          <p>뉴스가 만들어지고 읽히는 방식은 빠르게 바뀌고 있습니다. 누구나 기사를 쓰고 퍼뜨릴 수 있는 시대일수록, 사실을 확인하고 책임 있게 전하는 언론의 역할은 더 무거워집니다. 저희 협회는 디지털 언론사들이 이 책임을 함께 나누고, 서로의 경험과 기술을 나누며 성장하기 위해 뜻을 모았습니다.</p>
          <p>협회는 윤리 기준을 세우고 지키는 일, 회원사 간 기사 교류와 공동 기획, 기자 교육과 디지털·AI 기술 공유, 회원사와 언론인의 권익 보호에 힘쓰겠습니다. 보건·복지, 국제물류, 이스라엘·기독교 등 각자의 전문 분야를 가진 회원사들이 함께할 때, 독자에게 더 깊고 넓은 뉴스를 전할 수 있다고 믿습니다.</p>
          <p>새롭게 출발하는 협회에 많은 관심과 참여를 부탁드립니다. 감사합니다.</p>
          <p className="pt-2 text-right font-bold">{GDPA.name} 임직원 일동</p>
        </div>
      </div>
    </SubPage>
  )
}
