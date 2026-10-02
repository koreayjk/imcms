// 해운 운임지수 (SCFI·KCCI) — 편집국이 매주 발표 값을 입력하고 홈페이지 위젯으로 보여준다
export type IndexKey = 'scfi' | 'kcci'
export type IndexPoint = { date: string; value: number; sample: boolean }
export type IndexSeries = Record<IndexKey, IndexPoint[]>

export const INDEX_INFO: Record<IndexKey, { label: string; name: string; source: string; schedule: string }> = {
  scfi: { label: 'SCFI', name: '상하이 컨테이너 운임지수', source: '상하이해운거래소(SSE)', schedule: '매주 금요일 발표' },
  kcci: { label: 'KCCI', name: '한국형 컨테이너 운임지수', source: '한국해양진흥공사(KOBC)', schedule: '매주 월요일 발표' },
}
export const INDEX_KEYS: IndexKey[] = ['scfi', 'kcci']

// 위젯에 보여줄 주 수
export const INDEX_WEEKS = 12
