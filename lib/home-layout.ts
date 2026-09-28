export const SLOTS = [
  { key: 'headline', label: '톱 헤드라인', count: 1, note: '홈페이지 가장 큰 기사' },
  { key: 'top', label: '톱 왼쪽', count: 2, note: '헤드라인 왼쪽 사진 기사' },
  { key: 'major', label: '주요뉴스', count: 6, note: '비우면 최신 기사로 자동 배치' },
  { key: 'pick', label: '이슈 PICK', count: 4, note: '채운 경우에만 홈페이지에 표시' },
] as const

export type SlotKey = (typeof SLOTS)[number]['key']
export type HomeLayout = Record<SlotKey, (string | null)[]>

export function normalizeLayout(raw: unknown): HomeLayout {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return Object.fromEntries(
    SLOTS.map((s) => {
      const arr = Array.isArray(src[s.key]) ? (src[s.key] as unknown[]) : []
      return [s.key, Array.from({ length: s.count }, (_, i) => (typeof arr[i] === 'string' ? (arr[i] as string) : null))]
    })
  ) as HomeLayout
}
