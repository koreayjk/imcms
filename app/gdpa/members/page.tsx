import type { Metadata } from 'next'
import { gdpaBase } from '@/lib/gdpa-server'
import { memberOutlets } from '@/lib/gdpa-data'
import SubPage from '@/components/gdpa/SubPage'

export const metadata: Metadata = { title: '회원사 소개' }
export const revalidate = 300

export default async function Members() {
  const outlets = await memberOutlets()
  return (
    <SubPage base={(await gdpaBase())} section="/members" current="/members" title="회원사 소개" wide>
      <p className="mb-8 text-[15.5px] text-[var(--g-sub)]">협회와 함께하는 회원사 <strong className="text-[var(--g-navy)]">{outlets.length}곳</strong>입니다. 이름을 누르면 각 회원사 홈페이지로 이동합니다.</p>
      <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {outlets.map((o, i) => (
          <li key={o.id} className="flex flex-col rounded-lg border border-[var(--g-line)] bg-white">
            <div className="flex h-[120px] items-center justify-center border-b border-[var(--g-line)] bg-[var(--g-soft)] px-6">
              {o.logo ? <img src={o.logo} alt={o.name} className="max-h-[64px] max-w-[260px] object-contain" /> : <span className="text-[24px] font-extrabold">{o.name}</span>}
            </div>
            <div className="flex flex-1 flex-col p-6">
              <p className="text-[12px] font-semibold text-[var(--g-gold-ink)]">회원사 {String(i + 1).padStart(2, '0')}</p>
              <h2 className="mt-1 text-[19px] font-bold">{o.name}</h2>
              <p className="mt-2 flex-1 text-[14.5px] leading-[1.7] text-[var(--g-sub)]">{o.intro}</p>
              {o.url && <a href={o.url} target="_blank" rel="noopener" className="mt-5 inline-flex w-fit items-center rounded border border-[var(--g-navy)] px-4 py-2 text-[14px] font-semibold text-[var(--g-navy)] hover:bg-[var(--g-navy)] hover:text-white">{o.domain} ↗</a>}
            </div>
          </li>
        ))}
      </ul>
    </SubPage>
  )
}
