import Link from 'next/link'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import PressForm from '@/components/cms/PressForm'

export default async function NewPressPage() {
  const { outletId } = await getCmsContext()
  const { t } = await getT()
  return (
    <div className="mx-auto max-w-[900px] px-4 py-5 md:px-8 md:py-8 pb-28 md:pb-28">
      <nav className="mb-5 flex items-center gap-1.5 text-[12.5px] text-muted" aria-label={t('현재 위치', 'Breadcrumb')}>
        <Link href="/press" className="hover:text-ink">{t('보도자료함', 'Press releases')}</Link>
        <span>›</span>
        <span className="text-ink">{t('직접 등록', 'Add manually')}</span>
      </nav>
      <div className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight">{t('보도자료 직접 등록', 'Add a press release manually')}</h1>
        <p className="mt-1 text-[13px] text-muted">{t('이메일·카카오톡 등으로 받은 보도자료를 붙여넣어 보도자료함에 올립니다. 편집국 모두가 함께 봅니다.', 'Paste a press release you received by email, KakaoTalk, or another channel to add it to the press inbox. Everyone in the newsroom can see it.')}</p>
      </div>
      <PressForm outletId={outletId} />
    </div>
  )
}
