'use client'

import { useEffect } from 'react'

// 같은 브라우저에서는 기사마다 12시간에 한 번만 센다
export default function ViewCounter({ id }: { id: string }) {
  useEffect(() => {
    const key = `im-viewed-${id}`
    try {
      const last = Number(localStorage.getItem(key) ?? 0)
      if (Date.now() - last < 12 * 3600_000) return
      localStorage.setItem(key, String(Date.now()))
    } catch {}
    fetch('/api/view', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }), keepalive: true }).catch(() => {})
  }, [id])
  return null
}
