// 홈페이지 배치 (홈페이지 설정에서 고른다). 저장 값 standard·bands 는 예전부터 쓰던 이름이라 그대로 둔다
//   ready: false 는 아직 만들지 않은 배치 (설정 화면에는 "준비 중"으로 보이고, 고를 수 없다)
export type HomeLayout = 'standard' | 'portal' | 'bands' | 'editorial' | 'cards'

export type HomeLayoutInfo = { key: HomeLayout; name: string; label: string; features: string; fit: string; ready: boolean }

// 보여 주는 순서: 한국 1·2·3, 미국 1·2
export const HOME_LAYOUTS: HomeLayoutInfo[] = [
  { key: 'standard', name: '한국 스타일 1', label: '표준 3단형', features: '왼쪽 서브 기사 · 가운데 큰 헤드라인 · 오른쪽 실시간 뉴스. 주요뉴스·많이 본 뉴스·전문뉴스가 이어집니다. 한국 인터넷신문의 가장 표준적인 모양.', fit: '일반 인터넷신문', ready: true },
  { key: 'portal', name: '한국 스타일 2', label: '포털 목록형', features: '큰 톱 1건 + 오른쪽 제목 목록, 맨 위 속보 띠. 제목을 많이 보여 줘서 기사가 많은 매체에 맞습니다.', fit: '기사가 많은 뉴스 매체', ready: true },
  { key: 'bands', name: '한국 스타일 3', label: '섹션 띠형', features: '톱 아래를 섹션별 가로 띠로 쌓습니다(속보형·큰 기사형·사진 4칸형). 분야가 뚜렷한 전문지에 맞습니다.', fit: '분야가 뚜렷한 전문지', ready: true },
  { key: 'editorial', name: '미국 스타일 1', label: '에디토리얼', features: '가운데 큰 신문 제호, 가는 구분선, 명조 제목의 클래식한 신문. 시사·분석·협회 매체에 맞습니다.', fit: '시사·분석·협회 매체', ready: true },
  { key: 'cards', name: '미국 스타일 2', label: '카드 매거진', features: '큰 히어로 사진 + 둥근 카드 그리드, 넓은 여백. 지역 언론·영문 매체·모바일 독자가 많은 곳에 맞습니다.', fit: '지역·영문·모바일 독자 중심', ready: true },
]

// 저장된 값 → 쓸 수 있는 배치 (모르는 값·아직 안 만든 배치는 한국 스타일 1)
export function parseHomeLayout(v: unknown): HomeLayout {
  return HOME_LAYOUTS.find((l) => l.key === v && l.ready)?.key ?? 'standard'
}
