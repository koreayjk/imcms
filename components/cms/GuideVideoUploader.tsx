'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { GUIDE_BUCKET, guideFile } from '@/lib/help-videos'

type Slot = { id: string; title: string; poster: string; youtube: boolean; uploaded: { size: number; updatedAt: string | null } | null }

const MAX_MB = 50 // 프로젝트 기본 업로드 한도. Storage 설정에서 올렸다면 아래 숫자도 같이 올리세요
const mb = (n: number) => (n / 1024 / 1024).toFixed(1)

export default function GuideVideoUploader({ slots }: { slots: Slot[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<Record<string, { ok?: string; error?: string }>>({})
  const say = (id: string, m: { ok?: string; error?: string }) => setMsg((cur) => ({ ...cur, [id]: m }))

  async function upload(id: string, file: File | undefined) {
    if (!file) return
    if (!/\.mp4$/i.test(file.name) && file.type !== 'video/mp4') return say(id, { error: 'mp4 파일만 올릴 수 있습니다.' })
    if (file.size > MAX_MB * 1024 * 1024) return say(id, { error: `${mb(file.size)}MB 입니다. ${MAX_MB}MB 이하로 줄여 주세요.` })
    setBusy(id); say(id, {})
    const { error } = await createClient().storage.from(GUIDE_BUCKET).upload(guideFile(id), file, { upsert: true, contentType: 'video/mp4', cacheControl: '300' })
    setBusy(null)
    if (error) return say(id, { error: /bucket|not found/i.test(error.message) ? 'Supabase에서 supabase/guide-videos.sql 을 먼저 실행해 주세요.' : `올리지 못했습니다: ${error.message}` })
    say(id, { ok: '올렸습니다.' })
    router.refresh()
  }

  async function remove(id: string) {
    if (!window.confirm('이 영상을 지울까요? 이용안내에서 바로 사라집니다(유튜브 영상이 있으면 그것이 대신 나옵니다).')) return
    setBusy(id)
    const { error } = await createClient().storage.from(GUIDE_BUCKET).remove([guideFile(id)])
    setBusy(null)
    if (error) return say(id, { error: `지우지 못했습니다: ${error.message}` })
    say(id, { ok: '지웠습니다.' })
    router.refresh()
  }

  return (
    <ul className="mt-5 space-y-2.5">
      {slots.map((s, i) => (
        <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={s.poster} alt="" className="h-[54px] w-24 shrink-0 rounded object-cover" />
          <div className="min-w-0 flex-1 basis-56">
            <p className="text-[13.5px] font-bold leading-snug"><span className="mr-1.5 text-muted">{i + 1}</span>{s.title}</p>
            <p className="mt-0.5 text-[12px] text-muted">
              {s.uploaded ? <span className="font-semibold text-published">올라가 있음 · {mb(s.uploaded.size)}MB{s.uploaded.updatedAt ? ` · ${new Date(s.uploaded.updatedAt).toLocaleDateString('ko-KR')}` : ''}</span> : s.youtube ? '직접 올린 영상 없음 (유튜브 영상으로 나옴)' : <span className="text-draft">영상 없음 (이용안내에 안 나옴)</span>}
              <span className="ml-2 text-[11px]">파일 이름 {guideFile(s.id)}</span>
            </p>
            {msg[s.id]?.ok && <p role="status" className="mt-0.5 text-[12px] text-published">{msg[s.id].ok}</p>}
            {msg[s.id]?.error && <p role="alert" className="mt-0.5 text-[12px] text-danger">{msg[s.id].error}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <label className={`btn-secondary cursor-pointer px-3 py-1.5 text-[12.5px] ${busy ? 'pointer-events-none opacity-60' : ''}`}>
              {busy === s.id ? '올리는 중…' : s.uploaded ? '영상 바꾸기' : '영상 올리기'}
              <input type="file" accept="video/mp4" className="hidden" disabled={!!busy} onChange={(e) => { void upload(s.id, e.target.files?.[0]); e.target.value = '' }} />
            </label>
            {s.uploaded && <button type="button" disabled={!!busy} onClick={() => void remove(s.id)} className="rounded border border-line px-2.5 py-1.5 text-[12.5px] text-danger disabled:opacity-50">지우기</button>}
          </div>
        </li>
      ))}
    </ul>
  )
}
