'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Category } from '@/lib/types'

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
  const router = useRouter()
  const supabase = createClient()

  function toSlug(s: string) {
    return s.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
  }

  async function add() {
    if (!name.trim()) return
    setLoading(true)
    const { data, error } = await supabase
      .from('categories')
      .insert({ name: name.trim(), slug: slug.trim() || toSlug(name.trim()), outlet_id: outletId, sort_order: items.length })
      .select()
      .single()
    if (!error && data) {
      setItems([...items, data])
      setName('')
      setSlug('')
    }
    setLoading(false)
    router.refresh()
  }

  async function updateName(id: string) {
    if (!editName.trim()) return
    await supabase.from('categories').update({ name: editName.trim() }).eq('id', id)
    setItems(items.map(c => c.id === id ? { ...c, name: editName.trim() } : c))
    setEditId(null)
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
    router.refresh()
  }

  async function remove(id: string) {
    if (!confirm('카테고리를 삭제하시겠습니까?\n해당 카테고리의 기사는 "카테고리 없음" 상태가 됩니다.')) return
    await supabase.from('categories').delete().eq('id', id)
    setItems(items.filter(c => c.id !== id))
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* 추가 폼 */}
      <div className="rounded border border-line p-4">
        <h2 className="text-sm font-medium mb-3">새 카테고리 추가</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setSlug(toSlug(e.target.value)) }}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="카테고리명 (예: 사회, 경제, 문화)"
            className="flex-1 field-input"
          />
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="슬러그 (자동생성)"
            className="w-36 field-input text-muted"
          />
          <button onClick={add} disabled={!name.trim() || loading} className="btn-primary whitespace-nowrap">
            추가
          </button>
        </div>
      </div>

      {/* 카테고리 목록 */}
      <div>
        <div className="text-xs text-muted mb-2">
          드래그로 순서 변경이 불가할 경우 ↑ 버튼을 사용하세요.
        </div>
        <div className="space-y-1">
          {items.map((cat, i) => (
            <div
              key={cat.id}
              className="flex items-center justify-between rounded border border-line px-4 py-3 bg-paper"
            >
              <div className="flex items-center gap-3 flex-1">
                <button onClick={() => moveUp(i)} disabled={i === 0} className="text-muted hover:text-ink disabled:opacity-20 text-xs px-1">↑</button>
                {editId === cat.id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') updateName(cat.id); if (e.key === 'Escape') setEditId(null) }}
                    className="field-input py-1 flex-1"
                    autoFocus
                  />
                ) : (
                  <div>
                    <span className="text-sm font-medium">
                      {cat.parent_slug && <span className="mr-1 text-muted" title={`${items.find((x) => x.slug === cat.parent_slug)?.name ?? cat.parent_slug}의 2차 메뉴`}>↳</span>}
                      {cat.name}
                      {cat.parent_slug && <span className="ml-1.5 text-xs font-normal text-muted">{items.find((x) => x.slug === cat.parent_slug)?.name ?? ''} 하위</span>}
                    </span>
                    <span className="ml-2 text-xs text-muted font-mono">{cat.slug}</span>
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
                    <button onClick={() => { setEditId(cat.id); setEditName(cat.name) }} className="text-xs text-muted hover:text-ink">수정</button>
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
