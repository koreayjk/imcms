// 편집국 2단계 인증 (account-security.sql)
//   인증 앱을 켠 사람은 로그인 뒤 6자리 코드를 넣어야 편집국과 DB 자료를 연다 (DB에서도 막혀 있다)
//   코드를 넣은 로그인은 이 기기에서 로그아웃하지 않는 동안 유지되고, 아래 기간이 지나면 코드를 한 번 더 묻는다
export const MFA_DAYS = 90
// 총관리자·매니저는 모든 고객사를 열 수 있어 더 자주 확인한다
export const MFA_DAYS_STAFF = 30

type Factor = { status?: string; factor_type?: string }
type Claims = { aal?: string; session_id?: string; amr?: ({ method?: string; timestamp?: number } | string)[] }

// 로그인 토큰 안의 정보 (서명 확인은 getUser가 이미 했으므로 내용만 읽는다)
export function tokenClaims(token: string | null | undefined): Claims {
  try {
    const part = (token ?? '').split('.')[1]
    if (!part) return {}
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes)) as Claims
  } catch {
    return {}
  }
}

export function hasVerifiedFactor(user: { factors?: Factor[] | null } | null | undefined) {
  return (user?.factors ?? []).some((f) => f.status === 'verified')
}

// 이 로그인에서 6자리 코드를 넣었는가, 넣었다면 언제 (초)
export function mfaSession(token: string | null | undefined) {
  const c = tokenClaims(token)
  const totp = (c.amr ?? []).find((m) => typeof m === 'object' && m?.method === 'totp') as { timestamp?: number } | undefined
  return { aal2: c.aal === 'aal2', verifiedAt: totp?.timestamp ?? null }
}

// 코드를 다시 물을 때가 됐는가
export function mfaExpired(verifiedAt: number | null, staff: boolean) {
  if (!verifiedAt) return false
  const days = staff ? MFA_DAYS_STAFF : MFA_DAYS
  return Date.now() / 1000 - verifiedAt > days * 86_400
}
