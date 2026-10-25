import type { LogoStrip as Strip } from '@/lib/sites'

// 홈페이지 맨 아래: 협력·후원·제휴 기관 로고가 오른쪽에서 왼쪽으로 천천히 흐르는 띠 (마우스를 올리면 멈추고, 움직임을 줄인 설정이면 가만히 나열)
export default function LogoStrip({ strip, en = false }: { strip: Strip; en?: boolean }) {
  if (!strip.items.length) return null
  // 로고가 적어도 화면이 비지 않게 한 묶음을 12개 이상이 되도록 반복한다
  const reps = Math.max(1, Math.ceil(12 / strip.items.length))
  const group = Array.from({ length: reps }, () => strip.items).flat()
  const per = strip.speed === 'slow' ? 6 : strip.speed === 'fast' ? 2.5 : 4
  const seconds = Math.round(group.length * per)
  const logo = (it: Strip['items'][number], i: number, dup: boolean) => {
    const img = (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={it.img} alt={dup ? '' : it.name} loading="lazy" className="h-full w-full object-contain" />
    )
    return (
      <li key={`${dup ? 'b' : 'a'}${i}`} aria-hidden={dup || undefined} className="h-[64px] w-[140px] shrink-0 rounded border border-rule bg-white p-2">
        {it.url ? <a href={it.url} target="_blank" rel="noopener nofollow" tabIndex={dup ? -1 : undefined} className="block h-full w-full" title={it.name}>{img}</a> : img}
      </li>
    )
  }
  return (
    <section aria-label={strip.title || (en ? 'Partners' : '협력 기관')} className="border-t border-rule bg-[#FAFAFA] py-5">
      <style>{`@keyframes ls-run{from{transform:translateX(0)}to{transform:translateX(-50%)}}.ls-track:hover{animation-play-state:paused}@media (prefers-reduced-motion:reduce){.ls-track{animation:none!important;flex-wrap:wrap;width:auto!important}}`}</style>
      {strip.title && <h2 className="mx-auto mb-3 max-w-[1200px] px-4 text-[13px] font-bold text-sub">{strip.title}</h2>}
      <div className="overflow-hidden">
        <ul className="ls-track flex w-max gap-3" style={{ animation: `ls-run ${seconds}s linear infinite` }}>
          {group.map((it, i) => logo(it, i, false))}
          {group.map((it, i) => logo(it, i, true))}
        </ul>
      </div>
    </section>
  )
}
