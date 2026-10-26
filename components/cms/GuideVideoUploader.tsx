'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { GUIDE_BUCKET, guideFile } from '@/lib/help-videos'

type Slot = { id: string; title: string; poster: string; youtube: boolean; uploaded: { size: number; updatedAt: string | null } | null }

// 파일 이름으로 칸을 찾는다: 칸 번호.mp4(start.mp4) 이거나, 만들어 둔 영상 이름(사용법-03-…, 개통안내-0-…, 보도자료메일-…)
const NAME_RULES: [RegExp, string][] = [
  [/개통안내-0/, 'launch'],
  [/사용법-01-/, 'start'], [/사용법-02-/, 'security'], [/사용법-03-/, 'members'], [/사용법-04-/, 'write'], [/사용법-05-/, 'press'],
  [/사용법-06-/, 'guide'], [/사용법-07-/, 'photos'], [/사용법-08-/, 'approve'], [/사용법-09-/, 'home'], [/사용법-10-/, 'sections'],
  [/사용법-11-/, 'ads'], [/사용법-12-/, 'billing'], [/사용법-13-/, 'newsletter'], [/사용법-14-/, 'support'],
  [/보도자료메일-1-지메일자동받기-자세히/, 'pressmail-gmail-detail'], [/보도자료메일-1-/, 'pressmail-gmail'], [/보도자료메일-2-/, 'pressmail-other'],
]
function slotOf(name: string, ids: string[]): string | null {
  const base = name.replace(/\.mp4$/i, '')
  if (ids.includes(base)) return base
  if (/자막판/.test(name)) return null
  return NAME_RULES.find(([re]) => re.test(name))?.[1] ?? null
}

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

  // 여러 파일을 한꺼번에 고르면 이름으로 칸을 찾아 차례로 올린다
  const [bulk, setBulk] = useState<{ name: string; slot: string | null; state: string }[]>([])
  async function uploadMany(files: FileList | null) {
    if (!files?.length) return
    const ids = slots.map((s) => s.id)
    const list = Array.from(files).map((f) => ({ f, slot: slotOf(f.name, ids) }))
    setBulk(list.map(({ f, slot }) => ({ name: f.name, slot, state: !slot ? '칸을 찾지 못해 건너뜀 (칸에서 직접 올려 주세요)' : '기다리는 중' })))
    setBusy('bulk')
    for (let i = 0; i < list.length; i++) {
      const { f, slot } = list[i]
      if (!slot) continue
      const put = (state: string) => setBulk((cur) => cur.map((b, j) => (j === i ? { ...b, state } : b)))
      if (f.size > MAX_MB * 1024 * 1024) { put(`${mb(f.size)}MB — ${MAX_MB}MB 이하로 줄여 주세요`); continue }
      put('올리는 중…')
      const { error } = await createClient().storage.from(GUIDE_BUCKET).upload(guideFile(slot), f, { upsert: true, contentType: 'video/mp4', cacheControl: '300' })
      put(error ? `실패: ${/bucket|not found/i.test(error.message) ? 'guide-videos.sql 을 먼저 실행해 주세요' : error.message}` : '올렸습니다')
    }
    setBusy(null)
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
    <>
    <div className="mt-5 rounded-xl border border-dashed border-line bg-white p-4">
      <p className="text-[13.5px] font-bold">한꺼번에 올리기</p>
      <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">만들어 둔 영상 파일을 모두 골라 주세요. 파일 이름(사용법-03-…, 개통안내-0-…, 보도자료메일-…)을 보고 알맞은 칸에 차례로 올립니다. 이름에 “자막판”이 들어 있는 파일은 건너뜁니다.</p>
      <label className={`btn-primary mt-2.5 inline-block cursor-pointer px-4 py-2 text-[13px] ${busy ? 'pointer-events-none opacity-60' : ''}`}>
        {busy === 'bulk' ? '올리는 중… (창을 닫지 마세요)' : '영상 파일 여러 개 고르기'}
        <input type="file" accept="video/mp4" multiple className="hidden" disabled={!!busy} onChange={(e) => { void uploadMany(e.target.files); e.target.value = '' }} />
      </label>
      {bulk.length > 0 && (
        <ul className="mt-3 space-y-1 text-[12.5px]">
          {bulk.map((b, i) => (
            <li key={i} className="flex flex-wrap gap-x-2">
              <span className="font-semibold">{b.name}</span>
              <span className="text-muted">→ {b.slot ? slots.find((s) => s.id === b.slot)?.title : '—'}</span>
              <span className={b.state === '올렸습니다' ? 'text-published' : /실패|MB|찾지/.test(b.state) ? 'text-danger' : 'text-muted'}>{b.state}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
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
    </>
  )
}
