// IM 뉴스룸 로고 (남색 칸 + 흰 IM · 노란 NEWSROOM 띠). 편집국·소개 사이트·로그인 화면이 함께 쓴다
//   size: 한 변 픽셀, rounded: 모서리 (full이면 동그라미)
export default function BrandMark({ size = 36, rounded = 'md', className = '' }: { size?: number; rounded?: 'none' | 'md' | 'full'; className?: string }) {
  const r = rounded === 'full' ? 'rounded-full' : rounded === 'md' ? 'rounded-md' : ''
  return (
    <span className={`grid shrink-0 place-items-center bg-[#1D3461] ${r} ${className}`} style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/im-newsroom-mark.svg" alt="" width={Math.round(size * 0.82)} height={Math.round(size * 0.82 * 1183 / 1777)} className="block" />
    </span>
  )
}
