// 기자별 기사 목록 주소 (홈페이지 기사 아래 '다른기사 보기')
export const reporterHref = (name: string) => `/news/reporter?name=${encodeURIComponent(name.trim())}`
