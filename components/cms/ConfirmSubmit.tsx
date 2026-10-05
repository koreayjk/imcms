'use client'

import { useFormStatus } from 'react-dom'

// 한 번 더 묻고 보내는 제출 버튼 (지우기처럼 되돌릴 수 없는 일에)
export default function ConfirmSubmit({ message, children, className }: { message: string; children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={className} onClick={(e) => { if (!window.confirm(message)) e.preventDefault() }}>
      {pending ? '…' : children}
    </button>
  )
}
