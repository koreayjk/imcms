import type { Metadata } from 'next'
import { GDPA } from '@/lib/gdpa'
import { gdpaBase } from '@/lib/gdpa-server'
import SubPage from '@/components/gdpa/SubPage'

export const metadata: Metadata = { title: '오시는 길·문의' }

export default async function Contact() {
  const o = GDPA.office
  const rows: [string, string][] = [
    ['주소', o.address || '사무국 주소는 정해지면 안내합니다.'],
    ['전화', o.phone || '준비 중'],
    ['이메일', o.email || '준비 중'],
    ['운영 시간', o.hours],
  ]
  return (
    <SubPage base={(await gdpaBase())} section="/about" current="/about/contact" title="오시는 길·문의">
      <dl className="divide-y divide-[var(--g-line)] border-y-2 border-[var(--g-navy)]">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[110px_1fr] gap-4 py-4 text-[16px]">
            <dt className="font-bold text-[var(--g-navy)]">{k}</dt>
            <dd>{k === '이메일' && o.email ? <a href={`mailto:${o.email}`} className="underline underline-offset-2">{v}</a> : v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 text-[14.5px] leading-[1.75] text-[var(--g-sub)]">회원사 입회, 제휴, 행사·교육 문의는 위 연락처로 보내 주세요. 회원으로 가입하시면 공지와 행사 안내를 이메일로 받아 보실 수 있습니다.</p>
    </SubPage>
  )
}
