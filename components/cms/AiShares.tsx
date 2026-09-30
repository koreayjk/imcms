'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteShare } from '@/app/(main)/admin/ai-compare/actions'

export type ShareRow = {
  id: string
  token: string
  title: string
  blind: boolean
  created_at: string
  expires_at: string
  meta: { models?: { id: string; label: string }[]; releases?: { id: string; title: string }[] }
  reviews: { id: string; reviewer: string; picks: Record<string, string>; notes: Record<string, string>; comment: string | null; created_at: string }[]
}

// 보낸 검토 링크와 받은 검토: 모델별 “가장 좋음” 표와 기자별 의견
export default function AiShares({ shares }: { shares: ShareRow[] }) {
  const router = useRouter()
  const [open, setOpen] = useState<string | null>(shares.find((s) => s.reviews.length)?.id ?? null)
  const [copied, setCopied] = useState<string | null>(null)

  if (!shares.length) return null

  return (
    <section className="rounded-lg border border-line bg-white">
      <h2 className="border-b border-line px-5 py-3 text-[15px] font-bold">받은 검토</h2>
      <ul className="divide-y divide-line">
        {shares.map((s) => {
          const models = s.meta.models ?? []
          const releases = s.meta.releases ?? []
          const label = (id: string) => models.find((m) => m.id === id)?.label ?? id
          const title = (id: string) => releases.find((r) => r.id === id)?.title ?? '(삭제된 자료)'
          const votes = models.map((m) => ({ ...m, n: s.reviews.reduce((a, r) => a + Object.values(r.picks).filter((x) => x === m.id).length, 0) }))
          const total = votes.reduce((a, v) => a + v.n, 0)
          const expired = new Date(s.expires_at) < new Date()
          const url = typeof window === 'undefined' ? `/ai-review/${s.token}` : `${window.location.origin}/ai-review/${s.token}`
          return (
            <li key={s.id}>
              <div className="flex flex-wrap items-center gap-3 px-5 py-3">
                <button type="button" onClick={() => setOpen(open === s.id ? null : s.id)} className="min-w-0 flex-1 text-left">
                  <span className="text-[14px] font-bold">{s.title}</span>
                  <span className="ml-2 text-[12px] text-muted">
                    {new Date(s.created_at).toLocaleDateString('ko-KR')} · {s.blind ? '블라인드' : '이름 공개'} · 검토 {s.reviews.length}명
                    {expired && ' · 기한 지남'}
                  </span>
                </button>
                {total > 0 && (
                  <span className="flex flex-wrap gap-2 text-[12px] tabular-nums">
                    {votes.map((v) => <span key={v.id} className="rounded bg-[#F1F3F5] px-2 py-0.5">{v.label} <strong>{v.n}</strong></span>)}
                  </span>
                )}
                {!expired && (
                  <button
                    type="button"
                    onClick={async () => { try { await navigator.clipboard.writeText(url); setCopied(s.id) } catch {} }}
                    className="text-[12.5px] text-review underline underline-offset-2"
                  >
                    {copied === s.id ? '복사됨 ✓' : '링크 복사'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={async () => {
                    if (!confirm('이 검토 링크와 받은 검토를 모두 지울까요? 링크도 더 이상 열리지 않습니다.')) return
                    const r = await deleteShare(s.id)
                    if (r.error) alert(r.error)
                    else router.refresh()
                  }}
                  className="text-[12.5px] text-danger underline underline-offset-2"
                >
                  삭제
                </button>
              </div>

              {open === s.id && (
                <div className="space-y-4 border-t border-line bg-[#FAFBFC] px-5 py-4">
                  {total > 0 && (
                    <div className="space-y-1.5">
                      {votes.sort((a, b) => b.n - a.n).map((v) => (
                        <div key={v.id} className="flex items-center gap-3 text-[13px]">
                          <span className="w-40 shrink-0 font-semibold">{v.label}</span>
                          <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#E9ECEF]">
                            <span className="block h-full rounded-full bg-published" style={{ width: `${(v.n / total) * 100}%` }} />
                          </span>
                          <span className="w-24 text-right tabular-nums text-muted">{v.n}표 · {Math.round((v.n / total) * 100)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {!s.reviews.length && <p className="text-[13px] text-muted">아직 받은 검토가 없습니다. 링크를 복사해 기자님께 보내 주세요.</p>}
                  {s.reviews.map((r) => (
                    <div key={r.id} className="rounded-lg border border-line bg-white p-4">
                      <p className="text-[13.5px] font-bold">
                        {r.reviewer} <span className="text-[12px] font-normal text-muted">{new Date(r.created_at).toLocaleString('ko-KR')}</span>
                      </p>
                      {r.comment && <p className="mt-1 whitespace-pre-line text-[13px]">“{r.comment}”</p>}
                      <ul className="mt-2 space-y-1 text-[12.5px]">
                        {releases.filter((x) => r.picks[x.id] || r.notes[x.id]).map((x) => (
                          <li key={x.id} className="flex flex-wrap gap-x-2">
                            <span className="max-w-[420px] truncate text-muted">{title(x.id)}</span>
                            {r.picks[x.id] && <strong className="text-published">→ {label(r.picks[x.id])}</strong>}
                            {r.notes[x.id] && <span>· {r.notes[x.id]}</span>}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
