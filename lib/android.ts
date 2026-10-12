// 구글 플레이 앱 (편집국 app.imnewsroom.com 을 그대로 여는 앱, TWA)
//   앱 이름표(패키지 이름)는 스토어에 한 번 올리면 바꿀 수 없다
export const ANDROID_PACKAGE = 'com.imnewsroom.app'

// 앱 서명 지문(SHA-256). 공개 정보다 (비밀번호·키 파일이 아니다)
//   ① 앱 만들 때 받은 서명 키(업로드 키) 지문  ② 플레이 콘솔 → 앱 무결성 → 앱 서명 키 지문
//   둘 다 넣어야 스토어에서 받은 앱과 직접 설치한 시험 앱 모두 주소창 없이 열린다
export const ANDROID_CERT_SHA256: string[] = [
  // ① 업로드 키 (PWABuilder에서 만든 signing.keystore)
  'AD:16:13:91:79:CC:D0:4E:8E:BC:56:56:E3:24:95:1F:A6:78:FA:7D:4E:20:1B:48:26:6A:E5:73:CF:A5:68:37',
  // ② 앱 서명 키 (플레이 콘솔 → Google Play로 보호됨 → Play 앱 서명)
  'E8:33:4C:6E:0A:89:F3:F0:3C:E1:36:68:1F:D0:68:7C:6C:25:CA:44:DA:8A:85:70:46:26:7E:F1:EB:20:5F:BC',
]

// 플레이 스토어 앱 주소 (카톡에 그대로 보내면 미리보기가 안 떠서, 공유는 imnewsroom.com/app 으로 한다)
export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`

// 매체 독자용 앱 (매체 홈페이지를 주소창 없이 여는 앱, TWA). IM 회사 개발자 계정으로 올린다
//   도메인별로 적는다. 지문은 앱을 만든 뒤(업로드 키)·플레이 콘솔 앱 서명 키 화면에서 받아 넣는다
// live: 스토어에 공개된 뒤 true (그때부터 크롬이 매체 홈페이지에서 스토어 앱을 권한다)
export type OutletApp = { package: string; sha256: string[]; live?: boolean }
export const OUTLET_APPS: Record<string, OutletApp> = {
  'thecaretimes.net': { package: 'net.thecaretimes.app', sha256: [] },
}
export const outletApp = (domains: string[]) => domains.map((d) => OUTLET_APPS[d.replace(/^www\./, '')]).find(Boolean)
