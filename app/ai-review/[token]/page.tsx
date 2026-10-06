import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SLOTS, shareKey, slotOrder } from '@/lib/ai-share'
import AiReview, { type ReviewRelease } from '@/components/review/AiReview'
import { loadShare } from './data'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'AI 초안 검토 · IM 뉴스룸', robots: { index: false, follow: false } }

export default async function AiReviewPage(props: { params: Promise<{ token: string }> }) {
  const params = await props.params
  const share = await loadShare(params.token)
  if (!share) notFound()
  const { releases, models, results } = share.data
  const label = (id: string) => models.find((m) => m.id === id)?.label ?? id

  // 블라인드면 모델 이름·시간·비용을 화면에 보내지 않는다 (A·B·C만)
  const items: ReviewRelease[] = releases.map((r) => {
    const order = share.blind ? slotOrder(params.token, r.id, models.map((m) => m.id)) : models.map((m) => m.id)
    return {
      id: r.id, title: r.title, source: r.source, text: r.text,
      drafts: order.flatMap((m, i) => {
        const x = results[shareKey(r.id, m)]
        if (!x) return []
        return [{ slot: SLOTS[i], label: share.blind ? null : label(m), draft: x.draft, issues: x.issues, ms: share.blind ? null : x.ms, costUsd: share.blind ? null : x.costUsd }]
      }),
    }
  })

  return (
    <AiReview
      token={params.token}
      title={share.title}
      blind={share.blind}
      modelCount={models.length}
      expiresAt={share.expires_at}
      releases={items}
    />
  )
}
