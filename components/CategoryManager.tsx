'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Category } from '@/lib/types'
import { isSlug, toSlug } from '@/lib/slug'
import { refreshSiteMenu } from '@/app/(main)/admin/categories/actions'

export default function CategoryManager({
  categories,
  outletId,
}: {
  categories: Category[]
  outletId: string | null
}) {
  const [items, setItems] = useState(categories)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editSlug, setEditSlug] = useState('')
  const [msg, setMsg] = useState('')
  const router = useRouter()
  const supabase = createClient()

  // 주소(슬러그)는 홈페이지 메뉴 주소가 된다: 영문 소문자·숫자·하이픈만, 매체 안에서 겹치지 않게
  function checkSlug(v: string, selfId?: string) {
    if (!isSlug(v)) return '영문 주소는 영어 소문자·숫자·하이픈(-)만 쓸 수 있습니다. 예: education'
    if (items.some((c) => c.slug === v && c.id !== selfId)) return `“${v}” 주소는 이미 다른 카테고리가 쓰고 있습니다.`
    return ''
  }

  async function add() {
    if (!name.trim()) return
    const s = slug.trim() || toSlug(name)
    const bad = checkSlug(s)
    if (bad) { setMsg(bad); return }
    setMsg('')
    setLoading(true)
    const { data, error } = await supabase
      .from('categories')
      .insert({ name: name.trim(), slug: s, outlet_id: outletId, sort_order: items.length })
      .select()
      .single()
    if (!error && data) {
      setItems([...items, data])
      setName('')
      setSlug('')
      await refreshSiteMenu()
    } else if (error) setMsg(`추가하지 못했습니다: ${error.message}`)
    setLoading(false)
    router.refresh()
  }

  // 이름·주소 고치기. 주소를 바꾸면 그 아래 2차 메뉴들의 위 메뉴 주소도 함께 바꾼다
  async function updateName(id: string) {
    if (!editName.trim()) return
    const old = items.find((c) => c.id === id)
    const s = editSlug.trim()
    const bad = checkSlug(s, id)
    if (bad) { setMsg(bad); return }
    setMsg('')
    const { error } = await supabase.from('categories').update({ name: editName.trim(), slug: s }).eq('id', id)
    if (error) { setMsg(`저장하지 못했습니다: ${error.message}`); return }
    if (old?.slug && old.slug !== s) await supabase.from('categories').update({ parent_slug: s }).eq('outlet_id', outletId).eq('parent_slug', old.slug)
    setItems(items.map((c) => c.id === id ? { ...c, name: editName.trim(), slug: s } : c.parent_slug && c.parent_slug === old?.slug ? { ...c, parent_slug: s } : c))
    setEditId(null)
    await refreshSiteMenu()
    router.refresh()
  }

  async function moveUp(index: number) {
    if (index === 0) return
    const updated = [...items]
    ;[updated[index - 1], updated[index]] = [updated[index], updated[index - 1]]
    setItems(updated)
    await Promise.all([
      supabase.from('categories').update({ sort_order: index - 1 }).eq('id', updated[index - 1].id),
      supabase.from('categories').update({ sort_order: index }).eq('id', updated[index].id),
    ])
    await refreshSiteMenu()
    router.refresh()
  }

  async function remove(id: string) {
    if (!confirm('카테고리를 삭제하시겠습니까?\n해당 카테고리의 기사는 "카테고리 없음" 상태가 됩니다.')) return
    await supabase.from('categories').delete().eq('id', id)
    setItems(items.filter(c => c.id !== id))
    await refreshSiteMenu()
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* 추가 폼 */}
      <div className="rounded border border-line p-4">
        <h2 className="text-sm font-medium mb-3">새 카테고리 추가</h2>
        {/* 휴대폰: 이름 칸은 한 줄을 다 쓰고, 슬러그·추가 버튼은 다음 줄로 */}
        <div className="flex flex-wrap gap-2 sm:flex-nowrap">
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setSlug(toSlug(e.target.value)) }}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="카테고리명 (예: 사회, 경제, 문화)"
            className="min-w-full flex-1 field-input sm:min-w-0"
          />
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="영문 주소 (자동)"
            className="min-w-0 flex-1 field-input text-muted sm:w-36 sm:flex-none"
          />
          <button onClick={add} disabled={!name.trim() || loading} className="btn-primary whitespace-nowrap">
            추가
          </button>
        </div>
        <p className="mt-2 text-[12px] text-muted">영문 주소는 홈페이지 메뉴 주소(예: /section/education)가 됩니다. 한글 이름이면 로마자로 자동으로 채워지고, 고쳐 써도 됩니다. 바꾸면 홈페이지 메뉴에 바로 반영됩니다.</p>
        {msg && !editId && <p role="alert" className="mt-2 text-[13px] text-danger">{msg}</p>}
      </div>

      {/* 카테고리 목록 */}
      <div>
        {msg && editId && <p role="alert" className="mb-2 text-[13px] text-danger">{msg}</p>}
        <div className="text-xs text-muted mb-2">
          드래그로 순서 변경이 불가할 경우 ↑ 버튼을 사용하세요.
        </div>
        <div className="space-y-1">
          {items.map((cat, i) => (
            <div
              key={cat.id}
              className="flex items-center justify-between rounded border border-line px-4 py-3 bg-paper"
            >
              <div className="flex min-w-0 items-center gap-3 flex-1">
                <button onClick={() => moveUp(i)} disabled={i === 0} className="text-muted hover:text-ink disabled:opacity-20 text-xs px-1">↑</button>
                {editId === cat.id ? (
                  <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') updateName(cat.id); if (e.key === 'Escape') setEditId(null) }}
                      aria-label="카테고리 이름"
                      className="field-input min-w-[8rem] flex-1 py-1"
                      autoFocus
                    />
                    <input
                      type="text"
                      value={editSlug}
                      onChange={(e) => setEditSlug(e.target.value.toLowerCase())}
                      onKeyDown={(e) => { if (e.key === 'Enter') updateName(cat.id); if (e.key === 'Escape') setEditId(null) }}
                      aria-label="영문 주소"
                      placeholder="영문 주소 (예: education)"
                      className="field-input min-w-[8rem] flex-1 py-1 font-mono text-muted sm:w-40 sm:flex-none"
                    />
                  </div>
                ) : (
                  <div>
                    <span className="text-sm font-medium">
                      {cat.parent_slug && <span className="mr-1 text-muted" title={`${items.find((x) => x.slug === cat.parent_slug)?.name ?? cat.parent_slug}의 2차 메뉴`}>↳</span>}
                      {cat.name}
                      {cat.parent_slug && <span className="ml-1.5 text-xs font-normal text-muted">{items.find((x) => x.slug === cat.parent_slug)?.name ?? ''} 하위</span>}
                    </span>
                    {isSlug(cat.slug ?? '')
                      ? <span className="ml-2 break-all text-xs text-muted font-mono">{cat.slug}</span>
                      : <span className="ml-2 rounded bg-danger/10 px-1.5 py-0.5 text-[11.5px] font-semibold text-danger">영문 주소 없음 · 홈페이지에서 안 열립니다. “수정”에서 넣어 주세요</span>}
                  </div>
                )}
              </div>
              <div className="flex gap-2 shrink-0">
                {editId === cat.id ? (
                  <>
                    <button onClick={() => updateName(cat.id)} className="text-xs text-published hover:opacity-80">저장</button>
                    <button onClick={() => setEditId(null)} className="text-xs text-muted hover:text-ink">취소</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => { setEditId(cat.id); setEditName(cat.name); setEditSlug(isSlug(cat.slug ?? '') ? cat.slug : toSlug(cat.name)); setMsg('') }} className="text-xs text-muted hover:text-ink">수정</button>
                    <button onClick={() => remove(cat.id)} className="text-xs text-muted hover:text-danger">삭제</button>
                  </>
                )}
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <p className="py-10 text-center text-sm text-muted">
              카테고리가 없습니다. 위에서 추가하세요.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
