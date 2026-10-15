import { createClient } from './supabase'

// 2단계 인증 등으로 로그인 정보가 바뀐 직후, 서버가 같은 정보를 쿠키로 내려 주게 한다 (app/auth/session)
//   그다음 화면은 전체 새로 열어(router 가 아니라 location) 서버가 새 쿠키로 판단하게 한다
export async function syncSessionAndGo(path: string) {
  try {
    const { data: { session } } = await createClient().auth.getSession()
    if (session) {
      await fetch('/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: session.access_token, refresh_token: session.refresh_token }),
        credentials: 'same-origin',
      })
    }
  } catch {
    // 실패해도 이동은 한다 (일반 브라우저는 쿠키가 이미 맞다)
  }
  window.location.replace(path)
}
