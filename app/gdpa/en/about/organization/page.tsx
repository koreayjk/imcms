import type { Metadata } from 'next'
import { gdpaBaseEn } from '@/lib/gdpa-server'
import SubPage from '@/components/gdpa/SubPage'

export const metadata: Metadata = { title: 'Organization' }

function Box({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  return <div className={`rounded-lg px-5 py-3 text-center text-[15px] font-bold ${strong ? 'bg-[var(--g-navy)] text-white' : 'border border-[var(--g-line)] bg-white text-[var(--g-ink)]'}`}>{children}</div>
}

export default async function Organization() {
  return (
    <SubPage base={await gdpaBaseEn()} lang="en" section="/about" current="/about/organization" title="Organization">
      <p className="mb-8 rounded-lg bg-[var(--g-soft)] px-5 py-3 text-[14px] text-[var(--g-sub)]">This is the proposed structure drawn up while preparing to launch the Association. Officers and committees will be listed here once they are confirmed at the founding general assembly.</p>
      <div className="mx-auto flex max-w-[640px] flex-col items-center gap-3">
        <Box strong>General Assembly</Box>
        <span className="h-5 w-px bg-[var(--g-line)]" />
        <div className="flex items-center gap-4"><Box strong>Board of Directors</Box><span className="h-px w-8 bg-[var(--g-line)]" /><Box>Auditor</Box></div>
        <span className="h-5 w-px bg-[var(--g-line)]" />
        <Box strong>President</Box>
        <span className="h-5 w-px bg-[var(--g-line)]" />
        <Box>Vice President</Box>
        <span className="h-5 w-px bg-[var(--g-line)]" />
        <div className="grid w-full gap-3 sm:grid-cols-4">
          <Box>Secretariat</Box><Box>Ethics Committee</Box><Box>Education Committee</Box><Box>External Affairs Committee</Box>
        </div>
        <span className="h-5 w-px bg-[var(--g-line)]" />
        <Box>Member Outlets</Box>
      </div>
    </SubPage>
  )
}
