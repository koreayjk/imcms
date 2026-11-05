'use client'

import { useState } from 'react'
import { uploadImage } from '@/components/editor/upload'
import { useT } from './CmsLang'
import LogoStrip from '@/components/site/LogoStrip'
import GovPicker from './GovPicker'
import GovLogoFinder from './GovLogoFinder'
import { cleanLogoStrip, type LogoStrip as Strip } from '@/lib/sites'

// 홈 편집판 → "로고 띠 (홈 맨 아래, 협력·후원 기관)": 로고를 올리고 이름·누르면 갈 주소·순서·흐르는 속도를 정한다 (홈 편집판의 저장 버튼으로 함께 저장)
//   staff(운영팀)에게는 지자체 불러오기·로고 찾기 도구가 더 보인다
export default function LogoStripEditor({ strip, onChange, outletId, staff = false }: { strip: Strip; onChange: (next: Strip) => void; outletId: string; staff?: boolean }) {
  const t = useT()
  const [uploading, setUploading] = useState(false)
  const items = strip.items
  const put = (patch: Partial<Strip>) => onChange({ ...strip, ...patch })
  const putItems = (next: Strip['items']) => put({ items: next })
  const setItem = (i: number, patch: Partial<Strip['items'][number]>) => putItems(items.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const move = (i: number, d: number) => { const a = [...items]; const [x] = a.splice(i, 1); a.splice(i + d, 0, x); putItems(a) }
  const fail = (e: unknown) => window.alert(e instanceof Error ? e.message : t('로고를 올리지 못했습니다.', 'Could not upload the logo.'))
  async function pick(i: number, files: FileList | null) {
    const f = files?.[0]; if (!f) return
    setUploading(true)
    try { setItem(i, { img: await uploadImage(f, outletId) }) } catch (e) { fail(e) } finally { setUploading(false) }
  }
  async function add(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    try {
      const added: Strip['items'] = []
      for (const f of Array.from(files).slice(0, 40 - items.length)) added.push({ name: f.name.replace(/\.[^.]+$/, '').slice(0, 40), img: await uploadImage(f, outletId) })
      putItems([...items, ...added])
    } catch (e) { fail(e) } finally { setUploading(false) }
  }
  const preview = cleanLogoStrip(strip)
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <label className="block text-[13px]">
          <span className="font-semibold">{t('띠 제목 (선택)', 'Strip title (optional)')}</span>
          <input value={strip.title ?? ''} maxLength={30} onChange={(e) => put({ title: e.target.value })} placeholder={t('예: 함께하는 기관', 'e.g. Our partners')} className="field-input mt-1" />
        </label>
        <label className="block text-[13px]">
          <span className="font-semibold">{t('흐르는 속도', 'Scroll speed')}</span>
          <select value={strip.speed ?? 'normal'} onChange={(e) => put({ speed: e.target.value as 'slow' | 'normal' | 'fast' })} className="field-input mt-1">
            <option value="slow">{t('느리게', 'Slow')}</option><option value="normal">{t('보통', 'Normal')}</option><option value="fast">{t('빠르게', 'Fast')}</option>
          </select>
        </label>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((it, i) => (
          <li key={i} className="flex flex-col gap-1.5 rounded-lg border border-line p-2 text-[13px]">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span className="grid h-10 w-20 shrink-0 place-items-center rounded border border-line bg-white p-1">{it.img ? <img src={it.img} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-[11px] text-muted">{t('없음', 'None')}</span>}</span>
              <input value={it.name} maxLength={40} onChange={(e) => setItem(i, { name: e.target.value })} placeholder={t('기관 이름', 'Organization name')} aria-label={t('기관 이름', 'Organization name')} className="field-input min-w-0 flex-1 py-1.5" />
            </div>
            <input value={it.url ?? ''} maxLength={300} onChange={(e) => setItem(i, { url: e.target.value })} inputMode="url" placeholder={t('누르면 갈 주소  https://기관-홈페이지.com', 'Link address  https://organization-website.com')} aria-label={t('연결 주소', 'Link address')} className="field-input py-1.5" />
            <div className="flex items-center justify-between gap-1">
              <label className="btn-secondary cursor-pointer px-2.5 py-1 text-[12px]">
                {it.img ? t('로고 바꾸기', 'Change logo') : t('로고 올리기', 'Upload logo')}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => { void pick(i, e.target.files); e.target.value = '' }} />
              </label>
              <span className="flex gap-1">
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="rounded border border-line px-2 py-0.5 disabled:opacity-30" aria-label={t('앞으로', 'Move earlier')}>←</button>
                <button type="button" disabled={i === items.length - 1} onClick={() => move(i, 1)} className="rounded border border-line px-2 py-0.5 disabled:opacity-30" aria-label={t('뒤로', 'Move later')}>→</button>
                <button type="button" onClick={() => putItems(items.filter((_, j) => j !== i))} className="rounded border border-line px-2 py-0.5 text-danger" aria-label={t('빼기', 'Remove')}>×</button>
              </span>
            </div>
          </li>
        ))}
      </ul>
      {staff && <GovPicker items={items} onChange={putItems} />}
      {staff && <GovLogoFinder items={items} onChange={putItems} outletId={outletId} />}
      {items.length < 40 && (
        <label className="btn-secondary inline-block cursor-pointer px-4 py-2 text-[13px]">
          {t('+ 로고 올려 추가', '+ Upload logos to add')} {uploading && t('(올리는 중…)', '(uploading…)')}
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void add(e.target.files); e.target.value = '' }} />
        </label>
      )}
      <p className="text-[12px] text-muted">{t('로고 이미지는 가로로 긴 모양(가로 140 × 세로 64 정도) 배경이 흰색이거나 투명한 파일이 가장 보기 좋습니다. 최대 40개까지 넣을 수 있습니다. 로고를 올리면 줄마다 “누르면 갈 주소” 칸이 생깁니다. 주소(https://…)를 적으면 로고를 눌렀을 때 그 사이트가 새 창으로 열리고, 비워 두면 눌러도 이동하지 않습니다.', 'Logos look best as wide images (about 140 × 64) with a white or transparent background. Up to 40. After uploading, each row has a link field: enter an address (https://…) to open that site in a new window when the logo is clicked; if empty, clicking does nothing.')}</p>
      {preview && (
        <div className="pointer-events-none overflow-hidden rounded-lg border border-line" aria-hidden>
          <LogoStrip strip={preview} />
        </div>
      )}
    </div>
  )
}
