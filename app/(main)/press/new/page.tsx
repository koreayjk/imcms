import Link from 'next/link'
import { getCmsContext } from '@/lib/cms'
import PressForm from '@/components/cms/PressForm'

export default async function NewPressPage() {
  const { outletId } = await getCmsContext()
  return (
    <div className="mx-auto max-w-[900px] px-4 py-5 md:px-8 md:py-8 pb-28 md:pb-28">
      <nav className="mb-5 flex items-center gap-1.5 text-[12.5px] text-muted" aria-label="현재 위치">
        <Link href="/press" className="hover:text-ink">보도자료함</Link>
        <span>›</span>
        <span className="text-ink">직접 등록</span>
      </nav>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight">보도자료 직접 등록</h1>
        <p className="mt-1 text-[13px] text-muted">이메일·카카오톡 등으로 받은 보도자료를 붙여넣어 보도자료함에 올립니다. 편집국 모두가 함께 봅니다.</p>
      </div>
      <PressForm outletId={outletId} />
    </div>
  )
}
