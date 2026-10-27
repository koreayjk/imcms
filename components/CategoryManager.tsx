'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Category } from '@/lib/types'
import { isSlug, toSlug } from '@/lib/slug'
import { refreshSiteMenu } from '@/app/(main)/admin/categories/actions'
import { useT, useCmsLang } from '@/components/cms/CmsLang'

type Cat = Category & { specialty?: boolean | null; divider_before?: boolean | null }
// 고치는 동안의 목록: 카테고리와 구분선이 섞여 있다. "변경 저장"을 눌러야 DB에 들어간다
type CatRow = { kind: 'cat'; key: string; id?: string; name: string; slug: string; parent_slug: string | null }
type Row = CatRow | { kind: 'div'; key: string }

const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
let seq = 0
const newKey = () => `n${Date.now().toString(36)}${seq++}`

// 2차 메뉴를 1차 메뉴 바로 아래로 모아 보여 준다 (저장된 순서가 섞여 있어도 위 메뉴 밑에 붙는다)
function group(rows: Row[]): Row[] {
  const tops = new Set(rows.filter((r): r is CatRow => r.kind === 'cat' && !r.parent_slug).map((r) => r.slug))
  const kids = new Map<string, CatRow[]>()
  const out: Row[] = []
  for (const r of rows) {
    if (r.kind === 'cat' && r.parent_slug && tops.has(r.parent_slug)) { kids.set(r.parent_slug, [...(kids.get(r.parent_slug) ?? []), r]); continue }
    out.push(r)
  }
  return out.flatMap((r) => (r.kind === 'cat' && !r.parent_slug ? [r, ...(kids.get(r.slug) ?? [])] : [r]))
}

// 처음 목록: 저장된 구분선 자리가 있으면 그대로, 없으면 지금 홈페이지처럼 전문 섹션이 시작되는 자리에
function initialRows(cats: Cat[]): Row[] {
  const explicit = cats.some((c) => typeof c.divider_before === 'boolean')
  const rows: Row[] = []
  cats.forEach((c, i) => {
    const prevTop = cats.slice(0, i).reverse().find((x) => !x.parent_slug)
    const div = !c.parent_slug && (explicit ? !!c.divider_before : !!c.specialty && !prevTop?.specialty)
    if (div) rows.push({ kind: 'div', key: `d-${c.id}` })
    rows.push({ kind: 'cat', key: c.id, id: c.id, name: c.name, slug: c.slug ?? '', parent_slug: c.parent_slug ?? null })
  })
  return group(rows)
}

const snapshot = (rows: Row[]) => JSON.stringify(rows.map((r) => (r.kind === 'div' ? '|' : [r.id ?? r.key, r.name, r.slug, r.parent_slug])))

export default function CategoryManager({ categories, outletId, siteUrl }: { categories: Category[]; outletId: string | null; siteUrl?: string }) {
  const t = useT()
  const lang = useCmsLang()
  const [base, setBase] = useState(() => initialRows(categories as Cat[]))
  const [rows, setRows] = useState(base)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [newParent, setNewParent] = useState('')
  const lastSlug = useRef<Record<string, string>>({})
  const [editKey, setEditKey] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({})
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const dirty = snapshot(rows) !== snapshot(base)
  const cats = rows.filter((r): r is CatRow => r.kind === 'cat')
  const topSlugs = new Set(cats.filter((c) => !c.parent_slug).map((c) => c.slug))

  // 저장하지 않고 나가려 하면 브라우저가 한 번 묻는다
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function slugError(v: string, key: string) {
    if (!isSlug(v)) return t('영문 주소는 영어 소문자·숫자·하이픈(-)만 쓸 수 있습니다. 예: education', 'The URL slug can use only lowercase letters, numbers and hyphens (-). Example: education')
    if (cats.some((c) => c.slug === v && c.key !== key)) return t(`“${v}” 주소를 두 카테고리가 같이 쓰고 있습니다.`, `Two categories are using the slug “${v}”.`)
    return ''
  }

  function addCat() {
    const n = name.trim()
    if (!n) return
    const s = slug.trim() || toSlug(n)
    const key = newKey()
    const bad = slugError(s, key)
    if (bad) { setMsg({ error: bad }); return }
    setRows(group([...rows, { kind: 'cat', key, name: n, slug: s, parent_slug: newParent || null }]))
    setName(''); setSlug(''); setMsg({})
  }
  const addDivider = () => { setRows([...rows, { kind: 'div', key: newKey() }]); setMsg({}) }
  const removeRow = (key: string) => setRows(rows.filter((r) => r.key !== key))
  const patch = (key: string, p: Partial<Pick<CatRow, 'name' | 'slug'>>) => {
    const me = rows.find((x): x is CatRow => x.kind === 'cat' && x.key === key)
    // 1차 메뉴의 영문 주소를 고치면 그 아래 2차 메뉴의 위 메뉴 주소도 같이 (지운 채로 두는 동안은 마지막 주소를 기억해 둔다)
    const prev = lastSlug.current[key] ?? me?.slug ?? ''
    const follow = !!me && !me.parent_slug && !!p.slug && !!prev
    if (follow && p.slug) lastSlug.current[key] = p.slug
    setRows(rows.map((r) => {
      if (r.kind !== 'cat') return r
      if (r.key === key) return { ...r, ...p }
      return follow && r.parent_slug === prev ? { ...r, parent_slug: p.slug ?? r.parent_slug } : r
    }))
  }
  const setParent = (key: string, parent: string | null) => setRows(group(rows.map((r) => (r.kind === 'cat' && r.key === key ? { ...r, parent_slug: parent } : r))))
  const move = (from: number, to: number) => {
    if (to < 0 || to >= rows.length || from === to) return
    const next = [...rows]
    const [it] = next.splice(from, 1)
    next.splice(to, 0, it)
    setRows(group(next))
  }

  // ── 끌어서 순서 바꾸기: 손잡이를 잡으면 줄이 손가락을 그대로 따라오고, 다른 줄은 자리를 비켜 준다 ──
  //   놓으면 새 칸까지 남은 거리에서 부드럽게 들어앉는다. 손잡이는 위·아래 화살표 키로도 옮길 수 있다
  const listRef = useRef<HTMLUListElement>(null)
  const dragRef = useRef<{ from: number; startY: number; startScroll: number; step: number; mids: number[] } | null>(null)
  const [drag, setDrag] = useState<{ from: number; over: number; dy: number } | null>(null)
  const [settle, setSettle] = useState<{ key: string; dy: number } | null>(null)
  const [noAnim, setNoAnim] = useState(false)
  const scroller = () => document.getElementById('app-main')

  function onGrab(e: React.PointerEvent, from: number) {
    if (e.button !== 0) return
    e.preventDefault()
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const rects = (Array.from(listRef.current?.children ?? []) as HTMLElement[]).map((el) => el.getBoundingClientRect())
    const step = rects[1] ? rects[1].top - rects[0].top : rects[0].height + 4
    dragRef.current = { from, startY: e.clientY, startScroll: scroller()?.scrollTop ?? 0, step, mids: rects.map((r) => r.top + r.height / 2) }
    setDrag({ from, over: from, dy: 0 })
  }
  function onDrag(e: React.PointerEvent) {
    const d = dragRef.current
    if (!d) return
    const sc = scroller()
    // 화면 위·아래 끝에 가까우면 목록을 굴려 준다
    if (sc) { if (e.clientY > window.innerHeight - 110) sc.scrollTop += 10; else if (e.clientY < 120) sc.scrollTop -= 10 }
    const dy = e.clientY - d.startY + ((sc?.scrollTop ?? 0) - d.startScroll)
    const center = d.mids[d.from] + dy
    let over = d.from
    for (let i = d.from + 1; i < d.mids.length; i++) if (center > d.mids[i]) over = i
    for (let i = d.from - 1; i >= 0; i--) if (center < d.mids[i]) over = i
    setDrag({ from: d.from, over, dy })
  }
  function onDrop() {
    const d = dragRef.current
    dragRef.current = null
    if (!d || !drag) { setDrag(null); return }
    const key = rows[d.from].key
    const rest = drag.dy - (drag.over - d.from) * d.step
    setNoAnim(true)
    move(d.from, drag.over)
    setDrag(null)
    setSettle({ key, dy: rest })
    requestAnimationFrame(() => requestAnimationFrame(() => { setNoAnim(false); setSettle(null) }))
  }
  function rowStyle(i: number, key: string): React.CSSProperties {
    if (settle?.key === key) return { transform: `translateY(${settle.dy}px)`, transition: 'none' }
    if (!drag) return { transition: noAnim ? 'none' : `transform 0.4s ${EASE}` }
    if (i === drag.from) return { transform: `translateY(${drag.dy}px) scale(1.02)`, transition: `box-shadow 0.2s ${EASE}`, zIndex: 10, position: 'relative', boxShadow: '0 18px 40px -16px rgba(16,24,40,0.35)' }
    const step = dragRef.current?.step ?? 0
    const shift = i > drag.from && i <= drag.over ? -step : i < drag.from && i >= drag.over ? step : 0
    return { transform: shift ? `translateY(${shift}px)` : undefined, transition: `transform 0.3s ${EASE}` }
  }

  // ── 변경 저장: 지운 것 → 순서·이름·주소·구분선 → 새로 넣은 것 순서대로 DB에 넣고 홈페이지 메뉴를 새로 읽힌다 ──
  async function save() {
    for (const c of cats) {
      if (!c.name.trim()) { setMsg({ error: t('이름이 빈 카테고리가 있습니다.', 'A category has no name.') }); setEditKey(c.key); return }
      const bad = slugError(c.slug, c.key)
      if (bad) { setMsg({ error: `${c.name}: ${bad}` }); setEditKey(c.key); return }
    }
    setSaving(true)
    setMsg({})
    try {
      const baseCats = base.filter((r): r is CatRow => r.kind === 'cat')
      const gone = baseCats.filter((b) => !cats.some((c) => c.id === b.id)).map((b) => b.id!)
      if (gone.length) { const { error } = await supabase.from('categories').delete().in('id', gone); if (error) throw error }
      let dividerOk = true
      let parentOk = true
      let order = 0
      const saved: Row[] = []
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i]
        if (r.kind === 'div') { saved.push(r); continue }
        const fields: Record<string, unknown> = { name: r.name.trim(), slug: r.slug, sort_order: order++ }
        if (dividerOk) fields.divider_before = !r.parent_slug && rows[i - 1]?.kind === 'div'
        fields.parent_slug = r.parent_slug ?? null
        const run = () => r.id
          ? supabase.from('categories').update(fields).eq('id', r.id).select('id').single()
          : supabase.from('categories').insert({ ...fields, outlet_id: outletId }).select('id').single()
        let res = await run()
        // category-dividers.sql 전이면 구분선만 빼고 저장
        if (res.error && /divider_before/.test(res.error.message)) { dividerOk = false; delete fields.divider_before; res = await run() }
        // parent_slug 칸이 아직 없는 오래된 DB면 위 메뉴만 빼고 저장
        if (res.error && /parent_slug/.test(res.error.message)) { parentOk = false; delete fields.parent_slug; res = await run() }
        if (res.error) throw res.error
        const id = (res.data as { id: string } | null)?.id ?? r.id
        // 주소를 바꾸면 그 아래 2차 메뉴의 위 메뉴 주소도 함께
        const old = baseCats.find((b) => b.id === r.id)
        if (old?.slug && old.slug !== r.slug) await supabase.from('categories').update({ parent_slug: r.slug }).eq('outlet_id', outletId).eq('parent_slug', old.slug)
        saved.push({ ...r, id, key: id ?? r.key })
      }
      await refreshSiteMenu()
      setBase(saved)
      setRows(saved)
      setEditKey(null)
      const time = new Date().toLocaleTimeString(lang === 'en' ? 'en-US' : 'ko-KR', { hour: '2-digit', minute: '2-digit' })
      setMsg(dividerOk || !rows.some((r) => r.kind === 'div')
        ? { ok: t(`${time}에 저장했습니다. 홈페이지 메뉴에 바로 반영됩니다.`, `Saved at ${time}. The change shows in your homepage menu right away.`) }
        : { ok: t(`${time}에 저장했습니다.`, `Saved at ${time}.`), error: t('구분선은 아직 저장되지 않았습니다. 운영팀이 category-dividers.sql을 실행하면 쓸 수 있습니다.', 'Dividers have not been saved yet. They will work once the IM Newsroom team runs category-dividers.sql.') })
      router.refresh()
    } catch (e) {
      setMsg({ error: `${t('저장하지 못했습니다', 'Could not save')}: ${(e as { message?: string }).message ?? t('오류', 'error')} — ${t('다시 눌러 주세요.', 'please try again.')}` })
    } finally {
      setSaving(false)
    }
  }

  // 홈페이지 메뉴 미리보기 (1차 메뉴만)
  const preview = useMemo(() => {
    const out: { key: string; label: string; divider: boolean; subs: string[] }[] = []
    let pending = false
    for (const r of rows) {
      if (r.kind === 'div') { pending = true; continue }
      if (r.parent_slug) continue
      out.push({ key: r.key, label: r.name || t('(이름 없음)', '(no name)'), divider: pending, subs: rows.filter((x): x is CatRow => x.kind === 'cat' && x.parent_slug === r.slug && !!r.slug).map((x) => x.name || t('(이름 없음)', '(no name)')) })
      pending = false
    }
    return out
  }, [rows, t])

  return (
    <div className="space-y-6 pb-6">
      {/* 추가 */}
      <div className="rounded-lg border border-line bg-white p-4">
        <h2 className="mb-3 text-sm font-medium">{t('새 카테고리 추가', 'Add a category')}</h2>
        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
          <input type="text" value={name} onChange={(e) => { setName(e.target.value); setSlug(toSlug(e.target.value)) }} onKeyDown={(e) => e.key === 'Enter' && addCat()} placeholder={t('카테고리명 (예: 사회, 경제, 문화)', 'Category name (e.g. Society, Economy, Culture)')} aria-label={t('카테고리 이름', 'Category name')} className="field-input min-w-full flex-1 sm:min-w-0" />
          <input type="text" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} onKeyDown={(e) => e.key === 'Enter' && addCat()} placeholder={t('영문 주소 (자동)', 'URL slug (auto)')} aria-label={t('영문 주소', 'URL slug')} className="field-input min-w-0 flex-1 font-mono text-muted sm:w-40 sm:flex-none" />
          <select value={newParent} onChange={(e) => setNewParent(e.target.value)} aria-label={t('상위 메뉴', 'Parent menu')} className="field-input min-w-[9rem] sm:w-auto">
            <option value="">{t('1차 메뉴로', 'As a main menu')}</option>
            {cats.filter((c) => !c.parent_slug && c.slug).map((c) => <option key={c.key} value={c.slug}>{t(`${c.name} 아래 2차 메뉴로`, `As a submenu under ${c.name}`)}</option>)}
          </select>
          <button type="button" onClick={addCat} disabled={!name.trim()} className="btn-secondary pn-press">{t('목록에 넣기', 'Add to list')}</button>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-muted">{t('영문 주소는 홈페이지 메뉴 주소(예: /section/education)가 됩니다. 한글 이름이면 로마자로 자동으로 채워지고, 고쳐 써도 됩니다.', 'The slug becomes the homepage menu address (e.g. /section/education). For a Korean name it is filled in automatically in Roman letters, and you can edit it.')}</p>
      </div>

      {/* 홈페이지 메뉴 미리보기 */}
      <div className="rounded-lg border border-line bg-white px-4 py-3">
        <p className="text-[12px] font-semibold text-muted">{t('홈페이지 메뉴 미리보기', 'Homepage menu preview')}{dirty && <span className="ml-1.5 text-review">· {t('저장 전', 'not saved yet')}</span>}</p>
        <div className="mt-2 flex flex-wrap items-center gap-y-1.5 text-[13.5px] font-semibold">
          <span className="px-2">{t('전체기사', 'All stories')}</span>
          {preview.map((p) => (
            <span key={p.key} className={`px-2 ${p.divider ? 'ml-1 border-l border-ink/25 pl-3' : ''}`}>
              {p.label}
              {p.subs.length > 0 && <span className="block max-w-[11rem] text-[11px] font-normal leading-snug text-muted">└ {p.subs.join(' · ')}</span>}
            </span>
          ))}
        </div>
      </div>

      {/* 목록 */}
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted">{t('왼쪽', 'Grab the')} <span aria-hidden>⠿</span> {t('손잡이를 잡고 끌어서 순서를 바꿉니다. 구분선도 끌어서 원하는 자리에 놓으세요.', 'handle on the left and drag to reorder. Drag dividers into place the same way.')}</p>
          <button type="button" onClick={addDivider} className="pn-press rounded-full border border-dashed border-ink/30 px-3 py-1 text-[12.5px] font-semibold hover:border-ink">{t('+ 구분선 넣기', '+ Add divider')}</button>
        </div>
        <ul ref={listRef} className="space-y-1">
          {rows.map((r, i) => {
            const child = r.kind === 'cat' && !!r.parent_slug && topSlugs.has(r.parent_slug)
            const parentName = child ? cats.find((c) => c.slug === (r as CatRow).parent_slug)?.name : null
            const subCount = r.kind === 'cat' && !r.parent_slug ? cats.filter((c) => c.parent_slug === r.slug).length : 0
            return (
            <li key={r.key} style={rowStyle(i, r.key)} className={`flex items-center gap-2 rounded-lg border px-2 py-2 ${r.kind === 'div' ? 'border-dashed border-ink/25 bg-white' : child ? 'ml-5 border-line border-l-[3px] border-l-[#9DB0D4] bg-[#F8FAFD] sm:ml-8' : 'border-line bg-white'}`}>
              <button
                type="button"
                aria-label={t(`${r.kind === 'div' ? '구분선' : r.name} 옮기기 (위·아래 화살표 키로도 옮길 수 있습니다)`, `Move ${r.kind === 'div' ? 'divider' : r.name} (you can also use the up and down arrow keys)`)}
                onPointerDown={(e) => onGrab(e, i)}
                onPointerMove={onDrag}
                onPointerUp={onDrop}
                onPointerCancel={onDrop}
                onKeyDown={(e) => { if (e.key === 'ArrowUp') { e.preventDefault(); move(i, i - 1) } if (e.key === 'ArrowDown') { e.preventDefault(); move(i, i + 1) } }}
                className={`grid h-9 w-8 shrink-0 touch-none select-none place-items-center rounded-md text-[16px] text-muted hover:bg-paper hover:text-ink ${drag?.from === i ? 'cursor-grabbing' : 'cursor-grab'}`}
              >
                ⠿
              </button>
              {r.kind === 'div' ? (
                <>
                  <span className="flex flex-1 items-center gap-2 text-[12.5px] text-muted"><span className="h-px flex-1 bg-ink/20" />{t('메뉴 구분선', 'Menu divider')}<span className="h-px flex-1 bg-ink/20" /></span>
                  <button type="button" onClick={() => removeRow(r.key)} className="shrink-0 px-2 text-xs text-muted hover:text-danger">{t('빼기', 'Remove')}</button>
                </>
              ) : editKey === r.key ? (
                <>
                  <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                    <input type="text" value={r.name} onChange={(e) => patch(r.key, { name: e.target.value })} onKeyDown={(e) => e.key === 'Enter' && setEditKey(null)} aria-label={t('카테고리 이름', 'Category name')} className="field-input min-w-[8rem] flex-1 py-1" autoFocus />
                    <input type="text" value={r.slug} onChange={(e) => patch(r.key, { slug: e.target.value.toLowerCase() })} onKeyDown={(e) => e.key === 'Enter' && setEditKey(null)} aria-label={t('영문 주소', 'URL slug')} placeholder={t('영문 주소 (예: education)', 'URL slug (e.g. education)')} className="field-input min-w-[8rem] flex-1 py-1 font-mono text-muted sm:w-40 sm:flex-none" />
                    <select value={r.parent_slug ?? ''} onChange={(e) => setParent(r.key, e.target.value || null)} disabled={cats.some((c) => c.parent_slug === r.slug && !!r.slug)} aria-label={t('상위 메뉴', 'Parent menu')} title={t('2차 메뉴를 가진 메뉴는 다른 메뉴 아래로 넣을 수 없습니다', 'A menu that has submenus cannot be placed under another menu')} className="field-input w-full sm:w-auto sm:min-w-[9rem]">
                      <option value="">{t('1차 메뉴', 'Main menu')}</option>
                      {cats.filter((c) => !c.parent_slug && c.key !== r.key && c.slug).map((c) => <option key={c.key} value={c.slug}>{t(`${c.name} 아래 2차 메뉴`, `Submenu under ${c.name}`)}</option>)}
                  </select>
                  </div>
                  <button type="button" onClick={() => setEditKey(null)} className="shrink-0 px-2 text-xs font-semibold text-published">{t('완료', 'Done')}</button>
                </>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <span className={`text-sm ${child ? 'font-medium' : 'font-bold'}`}>
                      {child && <span className="mr-1.5 rounded bg-[#E6ECF7] px-1.5 py-0.5 text-[11px] font-semibold text-[#3B5688]" title={t('2차 메뉴', 'Submenu')}>{parentName} ›</span>}
                      {r.name}
                      {subCount > 0 && <span className="ml-2 text-[11.5px] font-normal text-muted">{t(`2차 메뉴 ${subCount}개`, `${subCount} ${subCount === 1 ? 'submenu' : 'submenus'}`)}</span>}
                      {!r.id && <span className="ml-1.5 rounded bg-review/10 px-1.5 py-0.5 text-[11px] font-semibold text-review">{t('새로 추가', 'New')}</span>}
                    </span>
                    {isSlug(r.slug)
                      ? <span className="ml-2 break-all font-mono text-xs text-muted">{r.slug}</span>
                      : <span className="ml-2 rounded bg-danger/10 px-1.5 py-0.5 text-[11.5px] font-semibold text-danger">{t('영문 주소 없음 · “수정”에서 넣어 주세요', 'No URL slug · add one under “Edit”')}</span>}
                  </div>
                  <div className="flex shrink-0 gap-2 pr-1">
                    <button type="button" onClick={() => { setEditKey(r.key); if (!isSlug(r.slug)) patch(r.key, { slug: toSlug(r.name) }) }} className="text-xs text-muted hover:text-ink">{t('수정', 'Edit')}</button>
                    <button type="button" onClick={() => { if (!r.id || window.confirm(t(`“${r.name}”을(를) 목록에서 뺄까요?\n“변경 저장”을 누르면 지워지고, 이 카테고리의 기사는 "카테고리 없음"이 됩니다.`, `Remove “${r.name}” from the list?\nIt will be deleted when you press “Save changes”, and stories in this category will become "Uncategorized".`))) removeRow(r.key) }} className="text-xs text-muted hover:text-danger">{t('삭제', 'Delete')}</button>
                  </div>
                </>
              )}
            </li>
            )
          })}
          {rows.length === 0 && <li className="py-10 text-center text-sm text-muted">{t('카테고리가 없습니다. 위에서 추가하세요.', 'There are no categories. Add one above.')}</li>}
        </ul>
      </div>

      {/* 저장 줄: 바꾼 게 있거나 방금 저장했으면 화면 아래에 붙어 있다 */}
      {(dirty || msg.ok || msg.error) && (
        <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 md:bottom-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-white/90 px-4 py-3 shadow-[0_18px_40px_-18px_rgba(16,24,40,0.45),inset_0_0_0_1px_rgba(15,17,21,0.08)] backdrop-blur-md">
            <p role={msg.error ? 'alert' : 'status'} className="min-w-[12rem] flex-1 text-[13px]">
              {msg.error && <span className="block text-danger">{msg.error}</span>}
              {dirty ? <span className="font-semibold text-review">{t('저장하지 않은 변경이 있습니다.', 'You have unsaved changes.')}</span>
                : msg.ok ? <span className="font-semibold text-published">✓ {msg.ok}</span> : null}
            </p>
            {!dirty && msg.ok && siteUrl && <a href={siteUrl} target="_blank" rel="noopener" className="whitespace-nowrap text-[13px] font-semibold text-[#2F6BF0] hover:underline">{t('홈페이지에서 보기 ↗', 'View on homepage ↗')}</a>}
            {dirty && (
              <>
                <button type="button" onClick={() => { setRows(base); setEditKey(null); setMsg({}) }} disabled={saving} className="whitespace-nowrap px-2 text-[13px] text-muted hover:text-ink">{t('변경 취소', 'Discard changes')}</button>
                <button type="button" onClick={save} disabled={saving} className="btn-primary pn-press">{saving ? t('저장 중…', 'Saving…') : t('변경 저장', 'Save changes')}</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
