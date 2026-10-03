import type { Metadata } from 'next'
import { gdpaBase } from '@/lib/gdpa-server'
import SubPage from '@/components/gdpa/SubPage'

export const metadata: Metadata = { title: '조직도' }

function Box({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return <div className={`rounded-lg px-5 py-3 text-center text-[15px] font-bold ${strong ? 'bg-[var(--g-navy)] text-white' : 'border border-[var(--g-line)] bg-white text-[var(--g-ink)]'}`}>{children}</div>
}

export default function Organization() {
  return (
    <SubPage base={gdpaBase()} section="/about" current="/about/organization" title="조직도">
      <p className="mb-8 rounded-lg bg-[var(--g-soft)] px-5 py-3 text-[14px] text-[var(--g-sub)]">아래는 협회 출범을 준비하며 정한 조직 구성안입니다. 임원과 위원회는 창립총회에서 확정되면 이곳에 안내합니다.</p>
      <div className="mx-auto flex max-w-[640px] flex-col items-center gap-3">
        <Box strong>총회</Box>
        <span className="h-5 w-px bg-[var(--g-line)]" />
        <div className="flex items-center gap-4"><Box strong>이사회</Box><span className="h-px w-8 bg-[var(--g-line)]" /><Box>감사</Box></div>
        <span className="h-5 w-px bg-[var(--g-line)]" />
        <Box strong>회장</Box>
        <span className="h-5 w-px bg-[var(--g-line)]" />
        <Box>부회장</Box>
        <span className="h-5 w-px bg-[var(--g-line)]" />
        <div className="grid w-full gap-3 sm:grid-cols-4">
          <Box>사무국</Box><Box>윤리위원회</Box><Box>교육위원회</Box><Box>대외협력위원회</Box>
        </div>
        <span className="h-5 w-px bg-[var(--g-line)]" />
        <Box>회원사</Box>
      </div>
    </SubPage>
  )
}
