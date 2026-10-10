'use client'

import { useEffect } from 'react'

// 편집국 앱(휴대폰 홈 화면·구글 플레이 앱): 인터넷이 끊겼을 때 보여줄 화면을 미리 받아 둔다 (public/sw.js)
export default function AppServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || location.hostname === 'localhost') return
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {})
  }, [])
  return null
}
