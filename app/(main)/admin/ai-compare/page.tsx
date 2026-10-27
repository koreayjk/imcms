import { redirect } from 'next/navigation'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import { AI_MODELS, activeModel, providerReady } from '@/lib/ai-draft'
import AiCompare from '@/components/cms/AiCompare'
import AiShares, { type ShareRow } from '@/components/cms/AiShares'

// 보도자료 전문(정책브리핑 포함)을 서울 리전에서 가져오고, 모델 한 번 호출에 최대 50초
export const preferredRegion = 'icn1'
export const maxDuration = 60

export default async function AiComparePage() {
  const { supabase, isStaff } = await getCmsContext()
  const { t } = await getT()
  if (!isStaff) redirect('/newsroom')
  const models = AI_MODELS.map((m) => ({ ...m, ready: providerReady(m.provider) }))
  const active = activeModel()
  // 보낸 검토 링크와 받은 검토 (DB 준비 전이면 조용히 건너뛴다)
  const { data: shares } = await supabase
    .from('ai_compare_shares')
    .select('id, token, title, blind, created_at, expires_at, meta, reviews:ai_compare_reviews(id, reviewer, picks, notes, comment, created_at)')
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-5 md:px-8 md:py-8">
      <header className="mb-6">
        <h1 className="text-[22px] font-bold tracking-tight">{t('AI 모델 비교', 'AI model comparison')}</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">
          {t('최근 보도자료로 모델마다 기사 초안을 만들어 나란히 비교합니다. 실제 걸린 시간·비용과, 원문에 없는 숫자·인용문이 들어갔는지 자동 점검 결과를 함께 보여줍니다.', 'Generate a story draft from recent press releases with each model and compare them side by side. Shows the actual time and cost, plus an automatic check for numbers or quotes that are not in the source.')}
          {t('지금 AI 초안에 쓰는 모델:', 'Model currently used for AI drafts:')} <strong className="text-ink">{active ? active.label : t('없음 (키 미설정)', 'None (no key set)')}</strong>
        </p>
      </header>
      <div className="space-y-6">
        <AiShares shares={(shares ?? []) as ShareRow[]} />
        <AiCompare models={models} />
      </div>
    </div>
  )
}
