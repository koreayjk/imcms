'use client'

import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

export default function PendingButton({ children, pending, className = '', disabled = false }: { children: ReactNode; pending: ReactNode; className?: string; disabled?: boolean }) {
  const { pending: isPending } = useFormStatus()
  return (
    <button type="submit" disabled={disabled || isPending} aria-busy={isPending} className={`${className} disabled:cursor-not-allowed disabled:opacity-50`}>
      {isPending ? pending : children}
    </button>
  )
}
