import type { Metadata } from 'next'
import Link from 'next/link'
import { gdpaBase } from '@/lib/gdpa-server'
import SubPage from '@/components/gdpa/SubPage'

export const metadata: Metadata = { title: '입회 안내' }

const STEPS = [
  ['입회 문의·신청', '홈페이지 회원가입 후 “회원사(언론사)”로 신청하거나 사무국에 문의합니다.'],
  ['서류 제출', '아래 서류를 사무국에 보냅니다.'],
  ['심사', '사무국 검토 후 이사회에서 입회를 심사합니다.'],
  ['입회 확정', '결과를 알려 드리고, 회원사 목록에 올립니다.'],
]

export default async function Join() {
  const base = (await gdpaBase())
  return (
    <SubPage base={base} section="/members" current="/members/join" title="입회 안내">
      <section>
        <h2 className="text-[20px] font-bold text-[var(--g-navy)]">입회 자격</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[16px] leading-[1.8]">
          <li>「신문 등의 진흥에 관한 법률」에 따라 등록한 인터넷신문 등 디지털 언론사</li>
          <li>협회의 설립 목적과 윤리강령에 동의하고 지키는 언론사</li>
          <li>기사를 꾸준히 발행하고 있는 언론사 (운영 기간·기사 수 기준은 입회 규정에서 정합니다)</li>
        </ul>
      </section>
      <section className="mt-12">
        <h2 className="text-[20px] font-bold text-[var(--g-navy)]">입회 절차</h2>
        <ol className="mt-5 grid gap-4 md:grid-cols-4">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="rounded-lg border border-[var(--g-line)] p-5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--g-navy)] text-[14px] font-bold text-white">{i + 1}</span>
              <p className="mt-3 font-bold">{t}</p>
              <p className="mt-1 text-[14px] leading-[1.65] text-[var(--g-sub)]">{d}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="mt-12">
        <h2 className="text-[20px] font-bold text-[var(--g-navy)]">제출 서류</h2>
        <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[16px] leading-[1.8]">
          <li>입회 신청서 (사무국 양식)</li>
          <li>정기간행물(인터넷신문) 등록증 사본</li>
          <li>사업자등록증 사본</li>
          <li>매체 소개서 (발행인·편집인, 주요 분야, 홈페이지 주소)</li>
        </ul>
        <p className="mt-4 rounded-lg bg-[var(--g-soft)] px-5 py-3 text-[14.5px] text-[var(--g-sub)]">입회비와 연회비는 창립총회에서 정해지면 공지사항으로 안내합니다.</p>
      </section>
      <div className="mt-12 flex flex-wrap gap-3">
        <Link href={`${base}/signup`} className="rounded bg-[var(--g-navy)] px-6 py-3 font-bold text-white">회원가입하고 신청하기</Link>
        <Link href={`${base}/about/contact`} className="rounded border border-[var(--g-line)] px-6 py-3 font-semibold">사무국 문의</Link>
      </div>
    </SubPage>
  )
}
