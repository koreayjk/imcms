'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Outlet } from '@/lib/types'

export default function OutletManager({ outlets }: { outlets: Outlet[] }) {
  const [items, setItems] = useState(outlets)
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [loading, setLoading] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDomain, setEditDomain] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function add() {
    if (!name.trim()) return
    setLoading(true)
    const { data, error } = await supabase
      .from('outlets')
      .insert({ name: name.trim(), domain: domain.trim() || null })
      .select()
      .single()
    if (!error && data) {
      setItems([...items, data])
      setName('')
      setDomain('')
    }
    setLoading(false)
    router.refresh()
  }

  async function update(id: string) {
    if (!editName.trim()) return
    await supabase.from('outlets').update({
      name: editName.trim(),
      domain: editDomain.trim() || null,
    }).eq('id', id)
    setItems(items.map(o => o.id === id ? { ...o, name: editName.trim(), domain: editDomain.trim() || null } : o))
    setEditId(null)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* 추가 폼 */}
      <div className="rounded border border-line p-4">
        <h2 className="text-sm font-medium mb-3">새 매체 추가</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="매체명 (예: 뉴미디어타임즈)"
            className="flex-1 field-input"
          />
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="도메인 (예: newmdtimes.com)"
            className="w-52 field-input"
          />
          <button onClick={add} disabled={!name.trim() || loading} className="btn-primary whitespace-nowrap">
            추가
          </button>
        </div>
      </div>

      {/* 매체 목록 */}
      <div className="space-y-1">
        {items.map((outlet) => (
          <div key={outlet.id} className="flex items-center justify-between rounded border border-line px-4 py-3">
            {editId === outlet.id ? (
              <div className="flex gap-2 flex-1 mr-4">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 field-input py-1"
                  autoFocus
                />
                <input
                  type="text"
                  value={editDomain}
                  onChange={(e) => setEditDomain(e.target.value)}
                  className="w-48 field-input py-1"
                />
              </div>
            ) : (
              <div>
                <span className="text-sm font-medium">{outlet.name}</span>
                {outlet.domain && (
                  <span className="ml-2 text-xs text-muted">{outlet.domain}</span>
                )}
              </div>
            )}
            <div className="flex gap-3 shrink-0">
              {editId === outlet.id ? (
                <>
                  <button onClick={() => update(outlet.id)} className="text-xs text-published hover:opacity-80">저장</button>
                  <button onClick={() => setEditId(null)} className="text-xs text-muted hover:text-ink">취소</button>
                </>
              ) : (
                <button
                  onClick={() => { setEditId(outlet.id); setEditName(outlet.name); setEditDomain(outlet.domain ?? '') }}
                  className="text-xs text-muted hover:text-ink"
                >
                  수정
                </button>
              )}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">등록된 매체가 없습니다.</p>
        )}
      </div>
    </div>
  )
}
