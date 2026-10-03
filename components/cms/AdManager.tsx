'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteBanner, saveBanner, setBannerActive, type AdInput, type AdState } from '@/app/(main)/admin/ads/actions'
import { AD_SLOTS, slotOf, type AdSlotId } from '@/lib/ads'
import AdSlotMap, { SLOT_COLOR, SLOT_NO, SlotThumb } from './AdSlotMap'
import { formatDateTime, toKstInput } from '@/lib/format'
import { uploadImage } from '@/components/editor/upload'

export type ManagedBanner = {
  id: string; slot: AdSlotId; kind: 'image' | 'code'; name: string
  image_url: string | null; mobile_image_url: string | null; link_url: string | null; code: string | null
  starts_at: string | null; ends_at: string | null; active: boolean; sort_order: number
  views: number; clicks: number; views30: number; clicks30: number
}

type Status = { label: string; cls: string }
function statusOf(b: ManagedBanner, now: number): Status {
  if (!b.active) return { label: '꺼짐', cls: 'bg-line text-muted' }
  if (b.starts_at && Date.parse(b.starts_at) > now) return { label: '예정', cls: 'status-scheduled' }
  if (b.ends_at && Date.parse(b.ends_at) <= now) return { label: '끝남', cls: 'bg-line text-muted' }
  return { label: '게재 중', cls: 'bg-published/10 text-published' }
}

const ctr = (v: number, c: number) => (v ? `${((c / v) * 100).toFixed(2)}%` : '-')

const EMPTY: AdInput = { slot: 'sidebar', kind: 'image', name: '', image_url: '', mobile_image_url: '', link_url: '', code: '', starts_at: '', ends_at: '', active: true, sort_order: 0 }

function toInput(b: ManagedBanner): AdInput {
  return {
    id: b.id, slot: b.slot, kind: b.kind, name: b.name, image_url: b.image_url ?? '', mobile_image_url: b.mobile_image_url ?? '',
    link_url: b.link_url ?? '', code: b.code ?? '', starts_at: toKstInput(b.starts_at), ends_at: toKstInput(b.ends_at), active: b.active, sort_order: b.sort_order,
  }
}

function ImagePick({ label, hint, value, onChange, outletId }: { label: string; hint: string; value: string; onChange: (v: string) => void; outletId: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  return (
    <div>
      <p className="field-label">{label}</p>
      <div className="flex flex-wrap items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="max-h-24 max-w-[240px] rounded border border-line bg-paper object-contain" />
        ) : (
          <span className="grid h-16 w-28 place-items-center rounded border border-dashed border-line text-[12px] text-muted">이미지 없음</span>
        )}
        <div className="flex gap-2">
          <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="btn-secondary px-3 py-1.5 text-[13px]">{busy ? '올리는 중…' : value ? '바꾸기' : '이미지 올리기'}</button>
          {value && <button type="button" onClick={() => onChange('')} className="btn-secondary px-3 py-1.5 text-[13px]">빼기</button>}
        </div>
        <input
          ref={ref}
          type="file"
          accept="image/*"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            setBusy(true); setErr('')
            try { onChange(await uploadImage(f, outletId)) } catch (x) { setErr(x instanceof Error ? x.message : '올리지 못했습니다.') }
            setBusy(false)
          }}
        />
      </div>
      <p className={`mt-1 text-[12px] ${err ? 'text-danger' : 'text-muted'}`}>{err || hint}</p>
    </div>
  )
}

function BannerForm({ initial, outletId, isStaff, onDone }: { initial: AdInput; outletId: string; isStaff: boolean; onDone: (msg: string) => void }) {
  const [f, setF] = useState<AdInput>(initial)
  const [state, setState] = useState<AdState>({})
  const [pending, start] = useTransition()
  const set = <K extends keyof AdInput>(k: K, v: AdInput[K]) => setF((x) => ({ ...x, [k]: v }))
  const slot = slotOf(f.slot)

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await saveBanner(f); setState(r); if (r.ok) onDone(r.ok) }) }}
      className="space-y-4 rounded-xl border border-ink/20 bg-white p-5"
    >
      <p className="text-[15px] font-bold">{f.id ? '배너 고치기' : '새 배너'}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-[13px]">
          <span className="field-label">광고 자리</span>
          <select value={f.slot} onChange={(e) => set('slot', e.target.value)} className="field-input">
            {AD_SLOTS.map((s) => <option key={s.id} value={s.id}>{s.label} — {s.where}</option>)}
          </select>
          {slot && (
            <span className="mt-2 flex items-center gap-3">
              <SlotThumb id={slot.id} />
              <span className="text-[12px] leading-relaxed text-muted">{slot.where}<br />권장 크기: {slot.size}</span>
            </span>
          )}
        </label>
        <label className="block text-[13px]">
          <span className="field-label">광고주·광고 이름</span>
          <input value={f.name} onChange={(e) => set('name', e.target.value)} maxLength={80} placeholder="예: ○○요양병원 10월 배너" className="field-input" />
          <span className="mt-1 block text-[12px] text-muted">이미지를 못 보는 독자에게 이 이름이 읽힙니다.</span>
        </label>
      </div>

      {isStaff && (
        <div role="group" aria-label="광고 종류" className="flex gap-2 text-[13px]">
          {(['image', 'code'] as const).map((k) => (
            <button key={k} type="button" aria-pressed={f.kind === k} onClick={() => set('kind', k)} className={`rounded-full px-3.5 py-1.5 font-semibold ${f.kind === k ? 'bg-ink text-white' : 'border border-line text-muted'}`}>
              {k === 'image' ? '이미지 배너' : '광고 코드 (운영팀)'}
            </button>
          ))}
        </div>
      )}

      {f.kind === 'image' ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <ImagePick label="PC 이미지 (필수)" hint="JPG·PNG·GIF(움직이는 배너 가능)" value={f.image_url} onChange={(v) => set('image_url', v)} outletId={outletId} />
            <ImagePick label="휴대폰 이미지 (선택)" hint="없으면 PC 이미지를 줄여서 보여줍니다." value={f.mobile_image_url} onChange={(v) => set('mobile_image_url', v)} outletId={outletId} />
          </div>
          <label className="block text-[13px]">
            <span className="field-label">누르면 갈 주소</span>
            <input value={f.link_url} onChange={(e) => set('link_url', e.target.value)} inputMode="url" placeholder="https://광고주-홈페이지.com" className="field-input" />
            <span className="mt-1 block text-[12px] text-muted">새 창으로 열리고 클릭 수가 집계됩니다. 비우면 누를 수 없는 배너가 됩니다.</span>
          </label>
        </>
      ) : (
        <label className="block text-[13px]">
          <span className="field-label">광고 코드</span>
          <textarea value={f.code} onChange={(e) => set('code', e.target.value)} rows={6} spellCheck={false} placeholder="구글 애드센스·카카오 애드핏 등에서 받은 코드를 그대로 붙여넣으세요." className="field-input resize-y font-mono text-[12.5px]" />
          <span className="mt-1 block text-[12px] text-muted">홈페이지에서 그대로 실행됩니다. 광고 회사에서 받은 코드만 넣으세요.</span>
        </label>
      )}

      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_120px]">
        <label className="block text-[13px]">
          <span className="field-label">시작 (한국 시간)</span>
          <input type="datetime-local" value={f.starts_at} onChange={(e) => set('starts_at', e.target.value)} className="field-input" />
          <span className="mt-1 block text-[12px] text-muted">비우면 바로 시작</span>
        </label>
        <label className="block text-[13px]">
          <span className="field-label">끝 (한국 시간)</span>
          <input type="datetime-local" value={f.ends_at} onChange={(e) => set('ends_at', e.target.value)} className="field-input" />
          <span className="mt-1 block text-[12px] text-muted">비우면 끌 때까지 계속</span>
        </label>
        <label className="block text-[13px]">
          <span className="field-label">순서</span>
          <input type="number" min={0} max={999} value={f.sort_order} onChange={(e) => set('sort_order', Number(e.target.value))} className="field-input tabular-nums" />
          <span className="mt-1 block text-[12px] text-muted">작을수록 위</span>
        </label>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-[14px]">
        <input type="checkbox" checked={f.active} onChange={(e) => set('active', e.target.checked)} className="h-4 w-4" />
        켜기 (기간 안이면 홈페이지에 나갑니다)
      </label>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <button type="submit" disabled={pending} className="btn-primary px-5">{pending ? '저장 중…' : f.id ? '저장' : '배너 올리기'}</button>
        <button type="button" onClick={() => onDone('')} className="btn-secondary">취소</button>
        {state.error && <p role="alert" className="text-[13px] font-semibold text-danger">{state.error}</p>}
      </div>
    </form>
  )
}

export default function AdManager({ banners, outletId, isStaff, now }: { banners: ManagedBanner[]; outletId: string; isStaff: boolean; now: number }) {
  const router = useRouter()
  const [editing, setEditing] = useState<AdInput | null>(null)
  const [msg, setMsg] = useState('')
  const [pending, start] = useTransition()

  const run = (fn: () => Promise<AdState>) => start(async () => { const r = await fn(); setMsg(r.error ?? r.ok ?? ''); router.refresh() })

  return (
    <div className="space-y-5">
      {editing ? (
        <BannerForm key={editing.id ?? 'new'} initial={editing} outletId={outletId} isStaff={isStaff} onDone={(m) => { setEditing(null); if (m) { setMsg(m); router.refresh() } }} />
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => setEditing({ ...EMPTY })} className="btn-primary px-5">+ 새 배너</button>
          {msg && <p role="status" className="text-[13px] text-published">{msg}</p>}
        </div>
      )}

      {!editing && <AdSlotMap counts={Object.fromEntries(AD_SLOTS.map((s) => [s.id, banners.filter((b) => b.slot === s.id && statusOf(b, now).label === '게재 중').length]))} />}

      {AD_SLOTS.map((s) => {
        const list = banners.filter((b) => b.slot === s.id)
        return (
          <section key={s.id} id={`slot-card-${s.id}`} aria-labelledby={`slot-${s.id}`} className="scroll-mt-20 rounded-xl border border-line bg-white transition-shadow" style={{ ['--tw-ring-color' as string]: SLOT_COLOR[s.id] }}>
            <header className="flex items-center gap-4 border-b border-line px-5 py-3">
              <SlotThumb id={s.id} />
              <div className="min-w-0 flex-1">
                <h2 id={`slot-${s.id}`} className="flex flex-wrap items-center gap-2 text-[15px] font-bold">
                  <span className="grid h-5 w-5 place-items-center rounded text-[11px] text-white" style={{ background: SLOT_COLOR[s.id] }}>{SLOT_NO[s.id]}</span>
                  {s.label} <span className="text-[12.5px] font-normal text-muted">· {s.where}</span>
                </h2>
                <p className="mt-1 text-[12px] text-muted">권장 {s.size}</p>
              </div>
            </header>
            {list.length ? (
              <ul className="divide-y divide-line">
                {list.map((b) => {
                  const st = statusOf(b, now)
                  return (
                    <li key={b.id} className="grid gap-3 px-5 py-4 md:grid-cols-[160px_1fr_auto] md:items-center">
                      <div className="grid h-20 w-full place-items-center overflow-hidden rounded border border-line bg-paper md:w-[160px]">
                        {b.kind === 'image' && b.image_url
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={b.image_url} alt="" className="max-h-full max-w-full object-contain" />
                          : <span className="font-mono text-[12px] text-muted">&lt;광고 코드&gt;</span>}
                      </div>
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2">
                          <span className={`status-badge px-2 py-0.5 ${st.cls}`}>{st.label}</span>
                          <strong className="truncate text-[14.5px]">{b.name}</strong>
                        </p>
                        <p className="mt-1 text-[12.5px] tabular-nums text-muted">
                          {b.starts_at ? formatDateTime(b.starts_at) : '바로'} ~ {b.ends_at ? formatDateTime(b.ends_at) : '끌 때까지'}
                          {b.link_url && <> · <a href={b.link_url} target="_blank" rel="noopener" className="underline underline-offset-2">{b.link_url.replace(/^https?:\/\//, '').slice(0, 40)}</a></>}
                        </p>
                        <p className="mt-1 text-[12.5px] tabular-nums">
                          최근 30일 노출 <strong>{b.views30.toLocaleString()}</strong> · 클릭 <strong>{b.clicks30.toLocaleString()}</strong> · 클릭률 {ctr(b.views30, b.clicks30)}
                          <span className="text-muted"> (전체 {b.views.toLocaleString()} / {b.clicks.toLocaleString()})</span>
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2 md:justify-end">
                        {(b.kind === 'image' || isStaff) && (
                          <>
                            <button type="button" disabled={pending} onClick={() => run(() => setBannerActive(b.id, !b.active))} className="btn-secondary px-3 py-1.5 text-[13px]">{b.active ? '끄기' : '켜기'}</button>
                            <button type="button" onClick={() => { setEditing(toInput(b)); window.scrollTo({ top: 0, behavior: 'smooth' }) }} className="btn-secondary px-3 py-1.5 text-[13px]">고치기</button>
                          </>
                        )}
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => { if (window.confirm(`“${b.name}” 배너를 지울까요? 노출·클릭 기록도 함께 지워집니다.`)) run(() => deleteBanner(b.id)) }}
                          className="btn-secondary px-3 py-1.5 text-[13px] text-danger"
                        >
                          지우기
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="px-5 py-5 text-[13px] text-muted">이 자리에 건 배너가 없습니다.</p>
            )}
          </section>
        )
      })}
    </div>
  )
}
