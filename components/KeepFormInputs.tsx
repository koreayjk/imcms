'use client'

import { useEffect } from 'react'

// React 19는 action 으로 보낸 양식을 처리가 끝나면 자동으로 비운다 (오류가 나도 입력이 사라진다)
//   예전처럼 입력을 그대로 두고, 일부러 비울 때만 form.dataset.allowReset = '1' 을 넣고 reset() 한다
export default function KeepFormInputs() {
  useEffect(() => {
    const onReset = (e: Event) => {
      const form = e.target as HTMLFormElement
      if (form.dataset?.allowReset) {
        delete form.dataset.allowReset
        return
      }
      e.preventDefault()
    }
    document.addEventListener('reset', onReset, true)
    return () => document.removeEventListener('reset', onReset, true)
  }, [])
  return null
}
