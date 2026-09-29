'use client'

import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

type Props = { children: ReactNode; pending: ReactNode; className?: string; disabled?: boolean; confirm?: string }

export default function PendingButton({ children, pending, className = '', disabled = false, confirm }: Props) {
  const { pending: isPending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={disabled || isPending}
      aria-busy={isPending}
      onClick={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault() } : undefined}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {isPending ? pending : children}
    </button>
  )
}
