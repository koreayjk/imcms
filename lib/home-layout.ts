// labelEn / noteEn: 편집국 영어 화면용 (한국어 label·note 는 그대로). 화면에서는 slotLabel(s, lang) / slotNote(s, lang)
export const SLOTS = [
  { key: 'headline', label: '톱 헤드라인', count: 10, note: '홈페이지 가장 큰 기사 (2개 이상 채우면 자동으로 넘어가는 슬라이드)', labelEn: 'Top headline', noteEn: 'The biggest story on the home page (fill 2 or more to make an auto-advancing slideshow)' },
  { key: 'top', label: '톱 왼쪽', count: 2, note: '헤드라인 왼쪽 사진 기사', labelEn: 'Top left', noteEn: 'Photo stories to the left of the headline' },
  { key: 'under', label: '최신 기사 칸', count: 4, note: '헤드라인 아래·오른쪽 최신 기사 자리. 비우면 최신 기사로 자동 배치', labelEn: 'Latest stories', noteEn: 'The latest-story slots near the headline. If left empty, the latest stories are placed automatically' },
  { key: 'major', label: '주요뉴스', count: 6, note: '비우면 최신 기사로 자동 배치', labelEn: 'Top stories', noteEn: 'If left empty, the latest stories are placed automatically' },
  { key: 'pick', label: '이슈 PICK', count: 4, note: '채운 경우에만 홈페이지에 표시', labelEn: 'Featured picks', noteEn: 'Shown on the home page only when filled' },
] as const

export const slotLabel = (s: (typeof SLOTS)[number], lang?: 'ko' | 'en') => (lang === 'en' ? s.labelEn : s.label)
export const slotNote = (s: (typeof SLOTS)[number], lang?: 'ko' | 'en') => (lang === 'en' ? s.noteEn : s.note)
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

// 톱 헤드라인 슬라이드가 다음 기사로 넘어가는 간격(초). 편집판에서 정하고, 편집판 자료(layout)에 heroSeconds 로 함께 저장한다
export const HERO_SECONDS = [3, 4, 5, 6, 8, 10, 15] as const
export const HERO_SECONDS_DEFAULT = 5
export function heroSecondsOf(raw: unknown): number {
  const n = raw && typeof raw === 'object' ? Number((raw as Record<string, unknown>).heroSeconds) : NaN
  return Number.isFinite(n) && n >= 2 && n <= 30 ? Math.round(n) : HERO_SECONDS_DEFAULT
}
