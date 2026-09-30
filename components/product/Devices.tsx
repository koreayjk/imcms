/* eslint-disable @next/next/no-img-element */
// 제품 화면을 담는 노트북·휴대폰·브라우저 틀

export function Browser({ src, alt, url = 'thecaretimes.net', className = '', eager = false }: { src: string; alt: string; url?: string; className?: string; eager?: boolean }) {
  return (
    <div className={`overflow-hidden rounded-xl border border-white/10 bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.55)] ${className}`}>
      <div className="flex items-center gap-2 border-b border-[#E4E6EA] bg-[#F4F5F7] px-3.5 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
        <span className="ml-3 flex-1 truncate rounded-md bg-white px-3 py-1 text-[11px] text-[#8C929B]">🔒 {url}</span>
      </div>
      <img src={src} alt={alt} width={1440} height={960} loading={eager ? 'eager' : 'lazy'} className="block h-auto w-full" />
    </div>
  )
}

export function Phone({ src, alt, className = '', eager = false }: { src: string; alt: string; className?: string; eager?: boolean }) {
  return (
    <div className={`rounded-[2.2rem] bg-[#0B0E14] p-[7px] shadow-[0_30px_70px_-15px_rgba(0,0,0,0.6)] ring-1 ring-white/15 ${className}`}>
      <div className="relative overflow-hidden rounded-[1.8rem] bg-white">
        <span className="absolute left-1/2 top-2 z-10 h-[18px] w-[70px] -translate-x-1/2 rounded-full bg-[#0B0E14]" aria-hidden />
        <img src={src} alt={alt} width={780} height={1688} loading={eager ? 'eager' : 'lazy'} className="block h-auto w-full" />
      </div>
    </div>
  )
}
