'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteFiles } from '@/app/(main)/media/actions'
import { formatBytes } from '@/lib/storage-quota'

export type FileRow = { bucket: string; name: string; size: number; at: string; owner: string | null; inUse: boolean; url: string }

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' })

export default function MediaManager({ outletId, files, showOwner, kind, total }: { outletId: string; files: FileRow[]; showOwner: boolean; kind: 'photo' | 'video'; total: number }) {
  const router = useRouter()
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({})
  const [pending, start] = useTransition()
  const free = files.filter((f) => !f.inUse)
  const toggle = (name: string) => setPicked((s) => { const n = new Set(s); if (n.has(name)) n.delete(name); else n.add(name); return n })
  const pickedSize = files.filter((f) => picked.has(f.name)).reduce((a, f) => a + f.size, 0)

  function remove() {
    if (!picked.size) return
    if (!window.confirm(`${picked.size}개 파일(${formatBytes(pickedSize)})을 지울까요? 지운 파일은 되돌릴 수 없습니다.`)) return
    setMsg({})
    start(async () => {
      const r = await deleteFiles(outletId, kind === 'video' ? 'videos' : 'media', Array.from(picked))
      if (r.error && !r.deleted) { setMsg({ error: r.error }); return }
      const extra = [r.inUse && `쓰이는 파일 ${r.inUse}개`, r.noPermission && `권한이 없는 파일 ${r.noPermission}개`, r.failed && `지우지 못한 파일 ${r.failed}개`].filter(Boolean).join(', ')
      setMsg({ ok: `${r.deleted}개를 지웠습니다.${extra ? ` (${extra}는 남겨 두었습니다)` : ''}`, error: r.error })
      setPicked(new Set())
      router.refresh()
    })
  }

  if (!files.length) {
    return <p className="mt-6 rounded-lg border border-line bg-white px-5 py-10 text-center text-[14px] text-muted">{kind === 'video' ? '영상이 없습니다.' : '사진이 없습니다.'}</p>
  }

  return (
    <div className="mt-4">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[13px]">
        <button type="button" onClick={() => setPicked(new Set(free.map((f) => f.name)))} disabled={!free.length || pending} className="rounded border border-line bg-white px-3 py-1.5 font-semibold disabled:opacity-40">이 쪽에서 쓰지 않는 파일 모두 고르기</button>
        {picked.size > 0 && <button type="button" onClick={() => setPicked(new Set())} className="rounded border border-line bg-white px-3 py-1.5">선택 해제</button>}
        <button type="button" onClick={remove} disabled={!picked.size || pending} className="rounded bg-danger px-3.5 py-1.5 font-semibold text-white disabled:opacity-40">
          {pending ? '지우는 중…' : `선택한 ${picked.size}개 지우기${picked.size ? ` (${formatBytes(pickedSize)})` : ''}`}
        </button>
        <span className="text-muted">이 쪽 {files.length}개 / 전체 {total.toLocaleString('ko-KR')}개</span>
      </div>
      {msg.ok && <p role="status" className="mb-3 rounded bg-review/10 px-3 py-2 text-[13px]">{msg.ok}</p>}
      {msg.error && <p role="alert" className="mb-3 rounded bg-danger/10 px-3 py-2 text-[13px] text-danger">{msg.error}</p>}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {files.map((f) => (
          <li key={f.name} className={`overflow-hidden rounded-lg border bg-white ${picked.has(f.name) ? 'border-danger ring-1 ring-danger' : 'border-line'}`}>
            <div className="relative bg-[#F3F4F6]">
              <a href={f.url} target="_blank" rel="noreferrer" aria-label="파일 열기" className="block">
                {kind === 'video'
                  ? <video src={`${f.url}#t=0.5`} preload="metadata" muted playsInline className="aspect-[4/3] w-full bg-black object-contain" />
                  // eslint-disable-next-line @next/next/no-img-element
                  : <img src={f.url} alt="" loading="lazy" className="aspect-[4/3] w-full object-cover" />}
              </a>
              <label className="absolute left-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded bg-white/90 shadow">
                <input type="checkbox" checked={picked.has(f.name)} disabled={f.inUse || pending} onChange={() => toggle(f.name)} aria-label={f.inUse ? '쓰고 있는 파일은 고를 수 없습니다' : '파일 고르기'} className="h-4 w-4" />
              </label>
              <span className={`absolute right-1.5 top-1.5 rounded px-1.5 py-0.5 text-[10.5px] font-semibold ${f.inUse ? 'bg-ink text-white' : 'bg-white/90 text-muted'}`}>{f.inUse ? '사용 중' : '쓰이지 않음'}</span>
            </div>
            <div className="px-2.5 py-2 text-[12px] leading-snug">
              <div className="font-semibold">{formatBytes(f.size)} <span className="font-normal text-muted">· {fmtDate(f.at)}</span></div>
              {showOwner && <div className="truncate text-muted">{f.owner || '올린 사람 모름'}</div>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
