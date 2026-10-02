'use client'

import { useEffect, useRef } from 'react'

// 광고 코드(애드센스·애드핏 등)를 그대로 실행한다. 운영팀만 넣을 수 있다 (ad-banners.sql 권한)
//   innerHTML 로 넣은 <script> 는 실행되지 않아서, 스크립트만 새로 만들어 붙인다
export default function AdCode({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.innerHTML = code
    el.querySelectorAll('script').forEach((old) => {
      const s = document.createElement('script')
      Array.from(old.attributes).forEach((a) => s.setAttribute(a.name, a.value))
      s.text = old.text
      old.replaceWith(s)
    })
    return () => { el.innerHTML = '' }
  }, [code])
  return <div ref={ref} />
}
