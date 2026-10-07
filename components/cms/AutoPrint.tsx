'use client'

import { useEffect } from 'react'

// 문서를 저장하고 넘어오면 인쇄 창을 바로 연다 (사진이 다 뜬 뒤)
//   예약한 인쇄는 화면이 다시 그려질 때 취소되므로 개발 모드에서 두 번 실행돼도 한 번만 열린다
export default function AutoPrint() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const go = () => { timer = setTimeout(() => window.print(), 400) }
    if (document.readyState === 'complete') go()
    else window.addEventListener('load', go, { once: true })
    // 주소에서 print 표시를 지워 새로고침해도 다시 열리지 않게
    const u = new URL(window.location.href)
    if (u.searchParams.has('print')) {
      u.searchParams.delete('print')
      window.history.replaceState(window.history.state, '', u.toString())
    }
    return () => { if (timer) clearTimeout(timer); window.removeEventListener('load', go) }
  }, [])
  return null
}
