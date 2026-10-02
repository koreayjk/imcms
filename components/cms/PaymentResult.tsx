import Link from 'next/link'
import type { ReactNode } from 'react'

// 결제 결과 화면 틀
export default function PaymentResult({ ok, title, children, actions }: { ok: boolean; title: string; children?: ReactNode; actions: { href: string; label: string; primary?: boolean }[] }) {
  return (
    <div className="mx-auto max-w-[560px] px-4 py-12 md:py-20">
      <div role={ok ? 'status' : 'alert'} className="rounded-2xl bg-white p-8 text-center ring-1 ring-black/5">
        <span className={`mx-auto grid h-14 w-14 place-items-center rounded-full text-[26px] font-bold text-white ${ok ? 'bg-published' : 'bg-danger'}`} aria-hidden>{ok ? '✓' : '!'}</span>
        <h1 className="mt-4 text-[21px] font-extrabold tracking-tight">{title}</h1>
        <div className="mt-3 space-y-1 text-[14px] leading-relaxed text-muted">{children}</div>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          {actions.map((a) => <Link key={a.href + a.label} href={a.href} className={a.primary ? 'btn-primary px-5' : 'btn-secondary'}>{a.label}</Link>)}
        </div>
      </div>
    </div>
  )
}
