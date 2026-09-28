'use client'

import { useEffect, useMemo, useState, type DragEvent } from 'react'
import { createClient } from '@/lib/supabase'
import { formatDateTime } from '@/lib/format'
import { SLOTS, type HomeLayout, type SlotKey } from '@/lib/home-layout'

export type BoardArticle = { id: string; title: string; thumbnail_url: string | null; published_at: string | null; category: string | null }

type Pos = { slot: SlotKey; index: number }
type DragData = { id: string; from?: Pos }

const GRID: Record<SlotKey, string> = {
  headline: 'grid-cols-1',
  top: 'grid-cols-2',
  major: 'grid-cols-3',
  pick: 'grid-cols-4',
}

export default function HomeBoard({ outletId, initialLayout, articles, savedAt }: {
  outletId: string
  initialLayout: HomeLayout
  articles: BoardArticle[]
  savedAt: string | null
}) {
  const [layout, setLayout] = useState(initialLayout)
  const [baseline, setBaseline] = useState(JSON.stringify(initialLayout))
  const [selected, setSelected] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [over, setOver] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(savedAt ? { ok: true, text: `마지막 저장 ${formatDateTime(savedAt)}` } : null)

  const byId = useMemo(() => new Map(articles.map((a) => [a.id, a])), [articles])
  const placed = useMemo(() => new Set(Object.values(layout).flat().filter(Boolean) as string[]), [layout])
  const dirty = JSON.stringify(layout) !== baseline
  const filtered = articles.filter((a) => !query.trim() || a.title.includes(query.trim()))

  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function place(id: string, to: Pos, from?: Pos) {
    setLayout((prev) => {
      const next = Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, [...v]])) as HomeLayout
      const displaced = next[to.slot][to.index]
      // 같은 기사가 두 자리에 있지 않게 기존 자리를 비운다
      for (const k of Object.keys(next) as SlotKey[]) next[k] = next[k].map((x) => (x === id ? null : x))
      next[to.slot][to.index] = id
      if (from && displaced && displaced !== id) next[from.slot][from.index] = displaced
      return next
    })
    setSelected(null)
  }

  function clear(pos: Pos) {
    setLayout((prev) => ({ ...prev, [pos.slot]: prev[pos.slot].map((x, i) => (i === pos.index ? null : x)) }))
  }

  function onDrop(e: DragEvent, to: Pos) {
    e.preventDefault()
    setOver(null)
    try {
      const data = JSON.parse(e.dataTransfer.getData('text/plain')) as DragData
      if (data.id) place(data.id, to, data.from)
    } catch {
      /* 다른 곳에서 끌어온 내용은 무시 */
    }
  }

  const dragStart = (data: DragData) => (e: DragEvent) => {
    e.dataTransfer.setData('text/plain', JSON.stringify(data))
    e.dataTransfer.effectAllowed = 'move'
  }

  async function save() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('home_layouts').upsert({
      outlet_id: outletId,
      layout,
      updated_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
    if (error) {
      setMessage({ ok: false, text: `저장하지 못했습니다: ${error.message}` })
    } else {
      setBaseline(JSON.stringify(layout))
      setMessage({ ok: true, text: '저장했습니다. 홈페이지에 바로 반영됩니다.' })
    }
  }

  return (
    <div className="grid grid-cols-[1fr_360px] items-start gap-6 pb-24">
      <div className="space-y-6">
        {SLOTS.map((s) => (
          <section key={s.key} className="rounded-lg border border-line bg-white p-5">
            <div className="mb-3 flex items-baseline gap-2">
              <h2 className="text-[15px] font-bold">{s.label}</h2>
              <span className="text-[12px] text-muted">{s.note}</span>
            </div>
            <div className={`grid gap-3 ${GRID[s.key]}`}>
              {layout[s.key].map((id, index) => {
                const pos = { slot: s.key, index }
                const key = `${s.key}-${index}`
                const a = id ? byId.get(id) : undefined
                const large = s.key === 'headline'
                return (
                  <div
                    key={key}
                    onDragOver={(e) => { e.preventDefault(); setOver(key) }}
                    onDragLeave={() => setOver((o) => (o === key ? null : o))}
                    onDrop={(e) => onDrop(e, pos)}
                    onClick={() => selected && place(selected, pos)}
                    className={`relative rounded border-2 transition-colors ${
                      over === key ? 'border-review bg-review/5' : a ? 'border-line bg-white' : 'border-dashed border-line bg-[#FAFBFC]'
                    } ${selected ? 'cursor-pointer hover:border-review' : ''} ${large ? 'min-h-[132px]' : 'min-h-[92px]'}`}
                  >
                    <span className="absolute left-2 top-1.5 text-[10.5px] font-semibold tabular-nums text-muted">{index + 1}</span>
                    {a ? (
                      <div draggable onDragStart={dragStart({ id: a.id, from: pos })} className={`flex cursor-grab gap-3 p-3 pt-6 active:cursor-grabbing ${large ? 'items-center' : ''}`}>
                        {a.thumbnail_url && (
                          <img src={a.thumbnail_url} alt="" className={`shrink-0 rounded-sm object-cover ${large ? 'h-[84px] w-[140px]' : 'h-[46px] w-[70px]'}`} />
                        )}
                        <div className="min-w-0 flex-1">
                          {a.category && <p className="text-[11px] text-muted">{a.category}</p>}
                          <p className={`line-clamp-2 font-semibold leading-snug ${large ? 'text-[16px]' : 'text-[13px]'}`}>{a.title}</p>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); clear(pos) }}
                          aria-label={`${s.label} ${index + 1}번 자리 비우기`}
                          className="absolute right-1.5 top-1 rounded px-1.5 text-[14px] text-muted hover:bg-danger/10 hover:text-danger"
                        >
                          ×
                        </button>
                      </div>
                    ) : (
                      <p className="flex h-full min-h-[inherit] items-center justify-center px-3 text-center text-[12px] text-muted">
                        {id ? '발행 취소된 기사입니다. 다른 기사로 바꿔주세요.' : s.key === 'pick' ? '비어 있음' : '비어 있음 · 자동 배치'}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>

      <aside className="sticky top-6 flex max-h-[calc(100vh-150px)] flex-col rounded-lg border border-line bg-white">
        <div className="border-b border-line p-4">
          <h2 className="text-[15px] font-bold">발행된 기사</h2>
          <label htmlFor="board-q" className="sr-only">기사 제목 검색</label>
          <input id="board-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="제목으로 찾기" className="field-input mt-2.5" />
          {selected && (
            <p className="mt-2 rounded bg-review/10 px-2.5 py-1.5 text-[12px] text-review">
              선택됨 — 왼쪽에서 넣을 자리를 누르세요. <button type="button" className="underline" onClick={() => setSelected(null)}>취소</button>
            </p>
          )}
        </div>
        <ul className="flex-1 divide-y divide-line overflow-y-auto">
          {filtered.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                draggable
                onDragStart={dragStart({ id: a.id })}
                onClick={() => setSelected((s) => (s === a.id ? null : a.id))}
                aria-pressed={selected === a.id}
                className={`flex w-full cursor-grab gap-3 px-4 py-3 text-left active:cursor-grabbing ${selected === a.id ? 'bg-review/10' : 'hover:bg-[#F8F9FA]'}`}
              >
                {a.thumbnail_url ? (
                  <img src={a.thumbnail_url} alt="" className="h-[42px] w-[64px] shrink-0 rounded-sm object-cover" />
                ) : (
                  <span className="h-[42px] w-[64px] shrink-0 rounded-sm bg-line/60" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 text-[13px] font-medium leading-snug">{a.title}</span>
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted">
                    {a.category && <span>{a.category}</span>}
                    <span className="tabular-nums">{formatDateTime(a.published_at)}</span>
                    {placed.has(a.id) && <span className="rounded bg-published/10 px-1 text-published">배치됨</span>}
                  </span>
                </span>
              </button>
            </li>
          ))}
          {!filtered.length && <li className="px-4 py-10 text-center text-[13px] text-muted">발행된 기사가 없습니다.</li>}
        </ul>
      </aside>

      <div className="fixed bottom-0 right-0 z-20 border-t border-line bg-white/95 backdrop-blur" style={{ left: 76 }}>
        <div className="mx-auto flex max-w-[1400px] items-center gap-3 px-8 py-3">
          {message && <p role="status" className={`text-[13px] ${message.ok ? 'text-muted' : 'text-danger'}`}>{message.text}</p>}
          {dirty && <span className="text-[13px] font-semibold text-draft">저장하지 않은 변경이 있습니다</span>}
          <div className="ml-auto flex gap-2">
            <a href="/" target="_blank" rel="noopener" className="btn-secondary">홈페이지 보기 ↗</a>
            <button type="button" onClick={() => setLayout(JSON.parse(baseline))} disabled={!dirty || saving} className="btn-secondary">되돌리기</button>
            <button type="button" onClick={save} disabled={!dirty || saving} className="btn-publish px-6">{saving ? '저장 중…' : '저장'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
