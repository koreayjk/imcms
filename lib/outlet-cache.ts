// 매체 홈페이지 데이터 캐시의 이름표 (lib/public-data.ts). 이 이름표를 지우면 그 매체의 홈·섹션·기사 화면이 바로 새로 읽힌다
export const outletTag = (outletId: string) => `outlet:${outletId}`
