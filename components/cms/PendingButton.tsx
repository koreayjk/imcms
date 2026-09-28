'use client'

import type { ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

export default function PendingButton({ children, pending, className = '' }: { children: ReactNode; pending: ReactNode; className?: string }) {
  const { pending: isPending } = useFormStatus()
  return (
    <button type="submit" disabled={isPending} aria-busy={isPending} className={className}>
      {isPending ? pending : children}
    </button>
  )
}
