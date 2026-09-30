// 메뉴를 누르면 바로 보이는 뼈대 화면 (서버가 데이터를 가져오는 동안)
export default function Loading() {
  return (
    <div className="mx-auto max-w-[1280px] animate-pulse px-4 py-5 md:px-8 md:py-8" aria-busy="true" aria-label="불러오는 중">
      <div className="h-7 w-40 rounded bg-line/80" />
      <div className="mt-2 h-4 w-64 max-w-full rounded bg-line/60" />
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-lg bg-line/60 md:h-28" />)}
      </div>
      <div className="mt-6 space-y-px overflow-hidden rounded-lg border border-line bg-white">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="px-5 py-4">
            <div className="h-4 w-3/4 rounded bg-line/70" />
            <div className="mt-2 h-3 w-1/3 rounded bg-line/50" />
          </div>
        ))}
      </div>
    </div>
  )
}
