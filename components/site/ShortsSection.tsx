// 홈페이지 "쇼츠" 구역: 유튜브 쇼츠를 세로 카드로 보여 준다. 카드를 누르면 유튜브(앱)에서 열려서 좋아요·구독·공유가 그대로 된다
//   (홈 안에서 재생하는 유튜브 재생기는 로그인이 안 돼 좋아요·공유가 안 먹어서 쓰지 않는다)
export type ShortCard = { id: string; title: string; date?: string }

export default function ShortsSection({ title, items, channelUrl, siteName, en }: { title: string; items: ShortCard[]; channelUrl?: string; siteName?: string; en?: boolean }) {
  if (!items.length) return null
  return (
    <section aria-labelledby="shorts-title" className="mx-auto mb-9 max-w-[1200px] px-4">
      <div className="overflow-hidden rounded-2xl bg-[#0E131B] px-4 pb-6 pt-6 shadow-[0_10px_30px_rgba(10,16,28,0.18)] sm:px-7 sm:pb-7">
        <div className="mb-5 flex items-end justify-between gap-3">
          <div className="flex items-center gap-3">
            <span aria-hidden className="grid h-8 w-11 place-items-center rounded-[9px] bg-[#FF0000] shadow-[0_4px_14px_rgba(255,0,0,0.35)]">
              <svg viewBox="0 0 24 24" width="16" height="16"><path d="M8 5.5v13l11-6.5z" fill="#fff" /></svg>
            </span>
            <div>
              <p className="text-[10.5px] font-bold uppercase tracking-[0.22em] text-[#FF5A52]">{siteName ? `${siteName} · Shorts` : 'Shorts'}</p>
              <h2 id="shorts-title" className="text-[21px] font-extrabold leading-tight tracking-[-0.03em] text-white">{title}</h2>
            </div>
          </div>
          {channelUrl && (
            <a href={channelUrl} target="_blank" rel="noopener noreferrer" className="flex-shrink-0 rounded-full border border-white/25 px-3.5 py-1.5 text-[12.5px] font-semibold text-white/90 transition-colors hover:border-white hover:bg-white hover:text-[#0E131B]">
              {en ? 'YouTube channel' : '유튜브 채널'} ↗
            </a>
          )}
        </div>

        <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:-mx-7 sm:px-7 lg:mx-0 lg:grid lg:grid-cols-6 lg:gap-4 lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden">
          {items.map((s) => (
            <li key={s.id} className="w-[44vw] max-w-[190px] flex-shrink-0 snap-start lg:w-auto lg:max-w-none">
              <a
                href={`https://www.youtube.com/shorts/${s.id}`}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${s.title} — ${en ? 'watch on YouTube' : '유튜브에서 보기'}`}
                className="group relative block aspect-[9/16] w-full overflow-hidden rounded-xl bg-black ring-1 ring-white/10 transition duration-300 hover:-translate-y-1 hover:ring-white/40 hover:shadow-[0_14px_28px_rgba(0,0,0,0.5)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://i.ytimg.com/vi/${s.id}/oardefault.jpg`} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.06]" />
                <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/25" />
                <span aria-hidden className="absolute left-2.5 top-2.5 rounded-full bg-black/55 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-sm">Shorts</span>
                <span aria-hidden className="absolute left-1/2 top-[44%] grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white/50 bg-white/20 opacity-80 backdrop-blur-md transition duration-300 group-hover:scale-110 group-hover:bg-white/35 group-hover:opacity-100">
                  <svg viewBox="0 0 24 24" width="16" height="16"><path d="M9 6v12l10-6z" fill="#fff" /></svg>
                </span>
                <span className="absolute inset-x-0 bottom-0 p-3">
                  {s.date && <span className="mb-1 block text-[11px] font-medium tabular-nums text-white/65">{s.date}</span>}
                  <span className="line-clamp-3 block text-[13.5px] font-bold leading-[1.38] tracking-[-0.01em] text-white">{s.title}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
