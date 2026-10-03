'use client'

import { useEffect, useRef, useState } from 'react'
import { findPhotos, importPhoto } from '@/app/(main)/articles/photos'
import type { PhotoHit } from '@/lib/photo-search'
import type { LibraryImage } from './MediaPanel'

// 추천 사진: 저작권 걱정 없는 공개 라이선스 사진 (CC0·퍼블릭 도메인·CC BY·CC BY-SA)
//   AI 검수가 끝나면 AI가 고른 검색어로 바로 찾아 준다. 검색어가 없으면 제목·태그로 직접 찾는다
//   가져오면 우리 저장소에 저장하고, 사진 설명에 작가·라이선스(출처 표기)를 자동으로 넣는다
export default function PhotoSuggest({ keywords, fallback, onAdd }: {
  keywords: string[]
  fallback: string
  onAdd: (img: LibraryImage) => void
}) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<PhotoHit[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const lastAuto = useRef('')

  async function search(q: string) {
    const term = q.trim()
    if (!term) return
    setQuery(term)
    setLoading(true)
    setError('')
    const r = await findPhotos(term)
    setLoading(false)
    if (r.error) { setError(r.error); setHits([]); return }
    setHits(r.hits ?? [])
  }

  // AI 검수가 새 검색어를 주면 첫 검색어로 한 번 찾아 둔다
  useEffect(() => {
    const first = keywords[0]
    if (first && lastAuto.current !== keywords.join('|')) {
      lastAuto.current = keywords.join('|')
      search(first)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keywords.join('|')])

  async function take(h: PhotoHit) {
    setBusy(h.id)
    setError('')
    const r = await importPhoto(h.id)
    setBusy(null)
    if (r.error || !r.url) { setError(r.error ?? '사진을 가져오지 못했습니다.'); return }
    onAdd({ url: r.url, caption: r.caption ?? h.credit })
    setAdded((s) => new Set(s).add(h.id))
  }

  return (
    <section aria-labelledby="photo-suggest-title" className="mt-6 border-t border-line pt-5">
      <h3 id="photo-suggest-title" className="text-[14px] font-bold">추천 사진 <span className="text-[11.5px] font-normal text-muted">저작권 걱정 없는 공개 사진</span></h3>
      <form onSubmit={(e) => { e.preventDefault(); search(query || fallback) }} className="mt-2 flex gap-1.5">
        <label htmlFor="photo-q" className="sr-only">사진 검색어</label>
        <input id="photo-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={fallback ? `예: ${fallback}` : '영어로 쓰면 더 잘 찾습니다 (예: Jerusalem)'} className="field-input min-w-0 flex-1 py-1.5 text-[12.5px]" />
        <button type="submit" disabled={loading} className="rounded bg-ink px-3 text-[12px] font-semibold text-white disabled:opacity-50">{loading ? '찾는 중…' : '찾기'}</button>
      </form>
      {keywords.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          <span className="text-[11.5px] text-muted">AI 추천 검색어</span>
          {keywords.map((k) => (
            <button key={k} type="button" onClick={() => search(k)} className={`rounded-full border px-2 py-0.5 text-[11.5px] ${query === k ? 'border-ink bg-ink text-white' : 'border-line hover:border-ink'}`}>{k}</button>
          ))}
        </div>
      )}
      {!keywords.length && hits === null && (
        <p className="mt-2 text-[11.5px] leading-relaxed text-muted">AI 검수를 하면 기사에 맞는 검색어로 사진을 찾아 드립니다. 검색어를 직접 넣어 찾아도 됩니다.</p>
      )}
      {error && <p role="alert" className="mt-2 text-[12px] text-danger">{error}</p>}
      {hits && !hits.length && !error && !loading && <p className="mt-2 text-[12px] text-muted">맞는 사진을 찾지 못했습니다. 다른 검색어(영어)로 찾아 보세요.</p>}
      {hits && hits.length > 0 && (
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {hits.map((h) => (
            <li key={h.id} className="overflow-hidden rounded border border-line bg-white">
              <a href={h.page || h.url} target="_blank" rel="noopener noreferrer" title={`${h.title} — 원본 페이지 보기`}>
                <img src={h.thumb} alt={h.title} loading="lazy" className="aspect-[4/3] w-full object-cover" />
              </a>
              <div className="p-1.5">
                <p className="truncate text-[10.5px] text-muted" title={h.credit}>{h.license} · {h.creator || '작가 미상'}</p>
                <button
                  type="button"
                  onClick={() => take(h)}
                  disabled={busy === h.id || added.has(h.id)}
                  className="mt-1 w-full rounded bg-ink py-1 text-[11.5px] font-semibold text-white disabled:opacity-50"
                >
                  {added.has(h.id) ? '가져옴' : busy === h.id ? '가져오는 중…' : '라이브러리로'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-muted">
        상업적 이용·수정이 허락된 라이선스(CC0·퍼블릭 도메인·CC BY·CC BY-SA)만 보여줍니다. 가져오면 사진 설명에 작가·라이선스가 들어가니 지우지 마세요(CC BY 조건).
        사람 얼굴이 크게 나온 사진은 초상권을, 상표가 보이는 사진은 광고처럼 보이지 않는지 확인하세요.
      </p>
    </section>
  )
}
