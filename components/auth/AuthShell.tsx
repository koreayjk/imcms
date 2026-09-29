import type { ReactNode } from 'react'

export default function AuthShell({ subtitle, children, footer }: { subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper py-12">
      <div className="w-full max-w-sm px-4">
        <div className="mb-10 text-center">
          <h1 className="text-xl font-semibold tracking-tight">IM CMS</h1>
          <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
        </div>
        {children}
        {footer && <div className="mt-8 text-center text-sm text-muted">{footer}</div>}
      </div>
    </div>
  )
}

export function OrDivider() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-muted" role="separator">
      <span className="h-px flex-1 bg-line" />
      또는
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}
