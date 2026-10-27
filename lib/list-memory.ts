// 목록 화면에서 상세 화면으로 갔다가 "목록으로"를 누르면 보던 쪽 번호·검색·스크롤 자리로 돌아오게 기억해 둔다
//   ScrollKeeper 가 화면마다 마지막 주소 뒤 조건(?page=2&q=…)을 적고, BackLink 가 그것을 읽어 간다
const LAST = 'im-last:'
const RESTORE = 'im-restore'

export function rememberSearch(pathname: string, search: string) {
  try { sessionStorage.setItem(LAST + pathname, search ? `?${search}` : '') } catch { /* 저장 못 해도 그만 */ }
}
export function recalledSearch(pathname: string): string {
  try { return sessionStorage.getItem(LAST + pathname) ?? '' } catch { return '' }
}
// 목록으로 돌아가는 이동임을 표시 (바로 다음 화면 이동에서 스크롤 자리도 되돌린다)
export function markRestore() {
  try { sessionStorage.setItem(RESTORE, String(Date.now())) } catch { /* 저장 못 해도 그만 */ }
}
export function takeRestore(): boolean {
  try {
    const t = Number(sessionStorage.getItem(RESTORE))
    sessionStorage.removeItem(RESTORE)
    return !!t && Date.now() - t < 5000
  } catch { return false }
}
