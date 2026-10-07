// 목록 한 쪽에 몇 건씩 볼지: 고를 수 있는 값과 기억해 둔 값 읽기 (서버·화면 둘 다 쓴다)
export const PAGE_SIZES = [20, 30, 50, 100] as const

export function pageSizeFrom(saved: string | undefined, fallback = 30) {
  const n = Number(saved)
  return (PAGE_SIZES as readonly number[]).includes(n) ? n : fallback
}
