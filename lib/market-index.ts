// 해운 운임지수 (SCFI·KCCI) — 편집국이 매주 발표 값을 입력하고 홈페이지 위젯으로 보여준다
export type IndexKey = 'scfi' | 'kcci'
export type IndexPoint = { date: string; value: number; sample: boolean }
export type IndexSeries = Record<IndexKey, IndexPoint[]>

export const INDEX_INFO: Record<IndexKey, { label: string; name: string; source: string; schedule: string }> = {
  scfi: { label: 'SCFI', name: '상하이 컨테이너 운임지수', source: '상하이해운거래소(SSE)', schedule: '매주 금요일 발표' },
  kcci: { label: 'KCCI', name: '한국형 컨테이너 운임지수', source: '한국해양진흥공사(KOBC)', schedule: '매주 월요일 발표' },
}
// 편집국 영어 화면용 이름 (공개 위젯은 INDEX_INFO 그대로)
export const INDEX_INFO_EN: Record<IndexKey, { label: string; name: string; source: string; schedule: string }> = {
  scfi: { label: 'SCFI', name: 'Shanghai Containerized Freight Index', source: 'Shanghai Shipping Exchange (SSE)', schedule: 'Published every Friday' },
  kcci: { label: 'KCCI', name: 'Korea Container Freight Index', source: 'Korea Ocean Business Corporation (KOBC)', schedule: 'Published every Monday' },
}
export const INDEX_KEYS: IndexKey[] = ['scfi', 'kcci']

// 위젯에 보여줄 주 수
export const INDEX_WEEKS = 12
