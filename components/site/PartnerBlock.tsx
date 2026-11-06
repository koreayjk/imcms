import type { LogoBlock } from '@/lib/sites'

// 홈 중간 "기관 로고 블록": 협력·후원·관련 기관 로고를 큼직한 상자로 가지런히 보여 준다 (로고 띠와 달리 움직이지 않고 한눈에 보인다)
//   홈페이지 설정 → 기관 로고 블록에서 채운 경우에만 나온다. 로고를 누르면 그 기관 사이트가 새 창으로 열린다 (광고가 아니라 "광고" 표시는 붙지 않는다)
const COLS: Record<3 | 4 | 5, string> = { 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' }
// 로고는 테두리 없이 사진만 큼직하게 (한 줄 개수가 적을수록 더 크게). 올린 이미지 원본 크기를 넘어 늘어나지는 않는다
const HEIGHT: Record<3 | 4 | 5, string> = { 3: 'h-[130px] sm:h-[170px] lg:h-[200px]', 4: 'h-[130px] sm:h-[150px] lg:h-[160px]', 5: 'h-[110px] sm:h-[130px] lg:h-[130px]' }

export default function PartnerBlock({ block, en = false, bare = false }: { block: LogoBlock; en?: boolean; bare?: boolean }) {
  if (!block.items.length) return null
  const cols = COLS[block.cols ?? 4]
  const height = HEIGHT[block.cols ?? 4]
  return (
    <section aria-label={block.title || (en ? 'Partners' : '협력 기관')} className={bare ? 'my-8' : 'mx-auto my-8 max-w-[1200px] px-4'}>
      {block.title && <h2 className="mb-3 text-[16px] font-bold tracking-[-0.02em] text-brand">{block.title}</h2>}
      <ul className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${cols}`}>
        {block.items.map((it, i) => {
          const img = (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={it.img} alt={it.name} loading="lazy" decoding="async" className="max-h-full max-w-full object-contain" />
          )
          const box = `flex ${height} items-center justify-center`
          return (
            <li key={i}>
              {it.url
                ? <a href={it.url} target="_blank" rel="noopener nofollow" title={it.name} className={`${box} transition-opacity hover:opacity-75`}>{img}</a>
                : <div className={box}>{img}</div>}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
