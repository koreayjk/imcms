'use client'

import { useState } from 'react'
import { findGovLogos, type GovLogoCandidate } from '@/app/(main)/admin/outlets/[id]/site/gov-logo-actions'
import { uploadImage } from '@/components/editor/upload'
import type { T } from '@/lib/cms-i18n'
import { useCmsLang, useT } from './CmsLang'

type Item = { name: string; img: string; url?: string }
type Row = { state: 'idle' | 'busy' | 'done' | 'error' | 'saved'; cands: GovLogoCandidate[]; msg?: string }

async function dataUrlToFile(c: GovLogoCandidate, name: string, t: T): Promise<File> {
  const blob = await (await fetch(c.dataUrl)).blob()
  // SVG·아이콘 파일은 올릴 수 있는 그림(PNG)으로 바꾼다
  if (c.type === 'image/svg+xml' || /icon/.test(c.type)) {
    const img = new Image()
    await new Promise<void>((ok, bad) => { img.onload = () => ok(); img.onerror = () => bad(new Error(t('그림을 읽지 못했습니다.', 'Could not read the image.'))); img.src = c.dataUrl })
    const w = img.naturalWidth || 600, h = img.naturalHeight || 300
    const scale = Math.min(4, 840 / Math.max(w, 1))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(w * scale); canvas.height = Math.round(h * scale)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    const png = await new Promise<Blob>((ok, bad) => canvas.toBlob((b) => (b ? ok(b) : bad(new Error(t('변환 실패', 'Conversion failed')))), 'image/png'))
    return new File([png], `${name}.png`, { type: 'image/png' })
  }
  const ext = c.type === 'image/jpeg' ? 'jpg' : c.type.split('/')[1]
  return new File([blob], `${name}.${ext}`, { type: c.type })
}

// 이름표(임시 로고)로 들어간 줄의 공식 로고 후보를 시청 홈페이지에서 찾아 보여 주고, 클릭하면 그 줄의 로고를 바꾼다 — 운영팀 전용
export default function GovLogoFinder({ items, onChange, outletId }: { items: Item[]; onChange: (items: Item[]) => void; outletId: string }) {
  const t = useT()
  const lang = useCmsLang()
  const [rows, setRows] = useState<Record<string, Row>>({})
  const [busyAll, setBusyAll] = useState(false)
  const targets = items.filter((i) => i.url && i.img.startsWith('/sites/'))
  if (!targets.length) return null
  const set = (name: string, r: Row) => setRows((x) => ({ ...x, [name]: r }))

  async function find(it: Item) {
    set(it.name, { state: 'busy', cands: [] })
    try {
      const r = await findGovLogos(it.url!)
      set(it.name, r.error ? { state: 'error', cands: [], msg: r.error } : { state: 'done', cands: r.candidates })
    } catch (e) {
      set(it.name, { state: 'error', cands: [], msg: e instanceof Error ? e.message : t('찾지 못했습니다.', 'Could not find it.') })
    }
  }
  async function findAll() {
    setBusyAll(true)
    for (const it of targets) { if (rows[it.name]?.state === 'saved') continue; await find(it) }
    setBusyAll(false)
  }
  async function pick(it: Item, c: GovLogoCandidate) {
    set(it.name, { ...(rows[it.name] ?? { cands: [] }), state: 'busy', cands: rows[it.name]?.cands ?? [] })
    try {
      const url = await uploadImage(await dataUrlToFile(c, it.name, t), outletId)
      onChange(items.map((x) => (x.name === it.name ? { ...x, img: url } : x)))
      set(it.name, { state: 'saved', cands: [] })
    } catch (e) {
      set(it.name, { state: 'error', cands: rows[it.name]?.cands ?? [], msg: e instanceof Error ? e.message : t('올리지 못했습니다.', 'Could not upload it.') })
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-line bg-[#F8F9FA] p-3 text-[13px]">
      <div className="flex flex-wrap items-center gap-2">
        <strong>{t('공식 로고 찾기', 'Find official logos')}</strong>
        <span className="text-muted">{t(`(이름표로 들어간 ${targets.length}곳 · 시청 홈페이지에서 로고 후보를 찾아 보여 줍니다)`, `(${targets.length} ${targets.length === 1 ? 'entry' : 'entries'} with a placeholder label · finds logo candidates on the city hall website)`)}</span>
        <button type="button" onClick={findAll} disabled={busyAll} className="btn-primary ml-auto px-3 py-1.5 text-[12.5px]">{busyAll ? t('찾는 중…', 'Searching…') : t('후보 모두 찾기', 'Find all candidates')}</button>
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
        {lang === 'en'
          ? <><strong className="text-body">Click</strong> the correct logo to replace the logo on that row. A wrong image may appear ahead of the right one, so always check with your own eyes. If there are no candidates, upload one yourself with “Change logo” on that row. Changes appear on the website only after you save. Local government logos come with terms of use such as the Korean Open Public License (KOGL), so check attribution requirements.</>
          : <>맞는 로고를 <strong className="text-body">클릭</strong>하면 그 줄의 로고가 바뀝니다. 틀린 그림이 후보 앞에 나올 수 있으니 꼭 눈으로 확인하세요. 후보가 없으면 그 줄의 “로고 바꾸기”로 직접 올립니다. 저장해야 홈페이지에 반영됩니다. 지자체 로고는 공공누리 등 사용 조건이 있으니 출처 표시 등을 확인하세요.</>}
      </p>
      <ul className="mt-2 space-y-2">
        {targets.map((it) => {
          const r = rows[it.name]
          return (
            <li key={it.name} className="rounded border border-line bg-white p-2">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="w-28 shrink-0">{it.name}</strong>
                <a href={it.url} target="_blank" rel="noopener" className="min-w-0 truncate text-[12px] text-review underline underline-offset-2">{it.url?.replace(/^https?:\/\//, '')}</a>
                {r?.state === 'saved' && <span className="font-semibold text-published">{t('✓ 바꿨습니다', '✓ Replaced')}</span>}
                {r?.state === 'busy' && <span className="text-muted">{t('찾는 중…', 'Searching…')}</span>}
                <button type="button" onClick={() => find(it)} disabled={r?.state === 'busy' || busyAll} className="btn-secondary ml-auto px-2.5 py-1 text-[12px]">{r?.cands?.length ? t('다시 찾기', 'Search again') : t('찾기', 'Find')}</button>
              </div>
              {r?.state === 'error' && <p className="mt-1 text-[12px] text-danger">{r.msg}</p>}
              {r?.cands?.length ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {r.cands.map((c) => (
                    <button key={c.src} type="button" onClick={() => pick(it, c)} title={`${c.why} · ${Math.round(c.bytes / 1024)}KB`} className="group rounded border border-line bg-white p-1.5 hover:border-ink">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={c.dataUrl} alt="" className="h-14 w-32 object-contain" />
                      <span className="block max-w-32 truncate text-[10.5px] text-muted">{c.why}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
