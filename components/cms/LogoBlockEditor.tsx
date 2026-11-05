'use client'

import { useState } from 'react'
import { uploadImage } from '@/components/editor/upload'
import { useT } from './CmsLang'
import PartnerBlock from '@/components/site/PartnerBlock'
import { cleanLogoStrip, type LogoBlock, type LogoStrip } from '@/lib/sites'

// 홈페이지 설정 → "기관 로고 블록(홈 중간)": 로고를 올리고, 기관 이름·누르면 갈 주소·순서를 정한다
//   로고 띠(logoStrip)와 같은 설정에 block 으로 함께 저장된다
export default function LogoBlockEditor({ strip, onChange, outletId }: { strip: LogoStrip | undefined; onChange: (next: LogoStrip) => void; outletId: string }) {
  const t = useT()
  const [uploading, setUploading] = useState(false)
  const block: LogoBlock = strip?.block ?? { items: [] }
  const items = block.items
  const put = (patch: Partial<LogoBlock>) => onChange({ ...(strip ?? { items: [] }), block: { ...block, ...patch } })
  const setItem = (i: number, patch: Partial<LogoBlock['items'][number]>) => put({ items: items.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
  const move = (i: number, d: number) => { const a = [...items]; const [x] = a.splice(i, 1); a.splice(i + d, 0, x); put({ items: a }) }
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
      const added: LogoBlock['items'] = []
      for (const f of Array.from(files).slice(0, 40 - items.length)) added.push({ name: f.name.replace(/\.[^.]+$/, '').slice(0, 40), img: await uploadImage(f, outletId) })
      put({ items: [...items, ...added] })
    } catch (e) { fail(e) } finally { setUploading(false) }
  }
  const preview = cleanLogoStrip({ items: [], block })?.block
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <label className="block text-[13px]">
          <span className="font-semibold">{t('제목 (선택)', 'Title (optional)')}</span>
          <input value={block.title ?? ''} maxLength={30} onChange={(e) => put({ title: e.target.value })} placeholder={t('예: 함께하는 기관', 'e.g. Our partners')} className="field-input mt-1" />
        </label>
        <label className="block text-[13px]">
          <span className="font-semibold">{t('한 줄에 보이는 개수 (PC)', 'Per row (desktop)')}</span>
          <select value={block.cols ?? 4} onChange={(e) => put({ cols: Number(e.target.value) as 3 | 4 | 5 })} className="field-input mt-1">
            <option value={3}>{t('3개 (크게)', '3 (large)')}</option><option value={4}>{t('4개', '4')}</option><option value={5}>{t('5개 (작게)', '5 (small)')}</option>
          </select>
        </label>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((it, i) => (
          <li key={i} className="flex flex-col gap-1.5 rounded-lg border border-line p-2 text-[13px]">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <span className="grid h-12 w-24 shrink-0 place-items-center rounded border border-line bg-white p-1">{it.img ? <img src={it.img} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-[11px] text-muted">{t('없음', 'None')}</span>}</span>
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
                <button type="button" onClick={() => put({ items: items.filter((_, j) => j !== i) })} className="rounded border border-line px-2 py-0.5 text-danger" aria-label={t('빼기', 'Remove')}>×</button>
              </span>
            </div>
          </li>
        ))}
      </ul>
      {items.length < 40 && (
        <label className="btn-secondary inline-block cursor-pointer px-4 py-2 text-[13px]">
          {t('+ 로고 올려 추가', '+ Upload logos to add')} {uploading && t('(올리는 중…)', '(uploading…)')}
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void add(e.target.files); e.target.value = '' }} />
        </label>
      )}
      <p className="text-[12px] text-muted">{t('로고는 가로로 넉넉한 모양(가로 400px 이상)에 배경이 흰색이거나 투명한 파일이 가장 선명합니다. 최대 40개까지 넣을 수 있고, 비워 두면 홈에 나오지 않습니다.', 'Logos look sharpest as wide images (400px or wider) with a white or transparent background. Up to 40, and if empty nothing is shown on the home page.')}</p>
      {preview && (
        <div className="pointer-events-none overflow-hidden rounded-lg border border-line bg-white" aria-hidden>
          <PartnerBlock block={preview} />
        </div>
      )}
    </div>
  )
}
