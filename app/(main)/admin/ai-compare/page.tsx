import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { AI_MODELS, activeModel, providerReady } from '@/lib/ai-draft'
import AiCompare from '@/components/cms/AiCompare'

// 보도자료 전문(정책브리핑 포함)을 서울 리전에서 가져오고, 모델 한 번 호출에 최대 50초
export const preferredRegion = 'icn1'
export const maxDuration = 60

export default async function AiComparePage() {
  const { isStaff } = await getCmsContext()
  if (!isStaff) redirect('/newsroom')
  const models = AI_MODELS.map((m) => ({ ...m, ready: providerReady(m.provider) }))
  const active = activeModel()

  return (
    <div className="mx-auto max-w-[1400px] px-8 py-8">
      <header className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight">AI 모델 비교</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          최근 보도자료로 모델마다 기사 초안을 만들어 나란히 비교합니다. 실제 걸린 시간·비용과, 원문에 없는 숫자·인용문이 들어갔는지 자동 점검 결과를 함께 보여줍니다.
          지금 AI 초안에 쓰는 모델: <strong className="text-ink">{active ? active.label : '없음 (키 미설정)'}</strong>
        </p>
      </header>
      <AiCompare models={models} />
    </div>
  )
}
