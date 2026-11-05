// labelEn / noteEn: 편집국 영어 화면용 (한국어 label·note 는 그대로). 화면에서는 slotLabel(s, lang) / slotNote(s, lang)
export const SLOTS = [
  { key: 'headline', label: '톱 헤드라인', count: 10, note: '홈페이지 가장 큰 기사 (비우면 사진 있는 최신 기사 5장이 자동으로 넘어가는 슬라이드)', labelEn: 'Top headline', noteEn: 'The biggest story on the home page (if empty, the 5 latest stories with photos advance automatically as a slideshow)' },
  { key: 'top', label: '톱 왼쪽', count: 2, note: '헤드라인 왼쪽 사진 기사', labelEn: 'Top left', noteEn: 'Photo stories to the left of the headline' },
  { key: 'under', label: '최신 기사 칸', count: 4, note: '헤드라인 아래·오른쪽 최신 기사 자리. 비우면 최신 기사로 자동 배치', labelEn: 'Latest stories', noteEn: 'The latest-story slots near the headline. If left empty, the latest stories are placed automatically' },
  { key: 'major', label: '주요뉴스', count: 6, note: '비우면 최신 기사로 자동 배치', labelEn: 'Top stories', noteEn: 'If left empty, the latest stories are placed automatically' },
  { key: 'pick', label: '이슈 PICK', count: 4, note: '비우면 최신 기사로 자동 배치', labelEn: 'Featured picks', noteEn: 'If left empty, the latest stories are placed automatically' },
  { key: 'photo', label: '포토뉴스', count: 12, note: '이슈 PICK 아래 색 띠. 비우면 사진 있는 최신 기사로 자동 배치, 4개씩 보이고 화살표로 옆으로 넘김', labelEn: 'Photo news', noteEn: 'A colored band below Featured picks. If left empty, the latest stories with photos are placed automatically; four at a time with arrows' },
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

import { cleanLogoBlock, type LogoBlock } from './sites'

// 홈 편집판 자료에 함께 저장한 기관 로고 블록 (없으면 undefined)
export const logoBlockOf = (raw: unknown): LogoBlock | undefined => cleanLogoBlock(raw && typeof raw === 'object' ? (raw as Record<string, unknown>).logoBlock : undefined)

// 톱 헤드라인 슬라이드가 다음 기사로 넘어가는 간격(초). 편집판에서 정하고, 편집판 자료(layout)에 heroSeconds 로 함께 저장한다
export const HERO_SECONDS = [3, 4, 5, 6, 8, 10, 15] as const
export const HERO_SECONDS_DEFAULT = 5
export function heroSecondsOf(raw: unknown): number {
  const n = raw && typeof raw === 'object' ? Number((raw as Record<string, unknown>).heroSeconds) : NaN
  return Number.isFinite(n) && n >= 2 && n <= 30 ? Math.round(n) : HERO_SECONDS_DEFAULT
}
