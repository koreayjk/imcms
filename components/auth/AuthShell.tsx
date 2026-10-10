import type { ReactNode } from 'react'
import BrandMark from '@/components/BrandMark'

export default function AuthShell({ subtitle, children, footer }: { subtitle: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-paper py-12">
      <div className="w-full max-w-sm px-4">
        <div className="mb-10 text-center">
          <h1 className="flex flex-col items-center gap-3 text-xl font-semibold tracking-tight"><BrandMark size={56} className="rounded-xl" />IM 뉴스룸 편집국</h1>
          <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
        </div>
        {children}
        {footer && <div className="mt-8 text-center text-sm text-muted">{footer}</div>}
        <PolicyLinks className="mt-10 justify-center" />
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

// 이용약관·개인정보처리방침·계정 삭제 안내 (앱 안에서도 보여야 한다: 구글 플레이 정책)
export function PolicyLinks({ className = '' }: { className?: string }) {
  return (
    <nav aria-label="약관과 방침" className={`flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted ${className}`}>
      <a href="/imnewsroom/terms" className="hover:text-ink hover:underline">이용약관</a>
      <a href="/imnewsroom/privacy" className="font-semibold hover:text-ink hover:underline">개인정보처리방침</a>
      <a href="/imnewsroom/account-deletion" className="hover:text-ink hover:underline">계정 삭제 안내</a>
    </nav>
  )
}
