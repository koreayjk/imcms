// 구글 플레이 앱 (편집국 app.imnewsroom.com 을 그대로 여는 앱, TWA)
//   앱 이름표(패키지 이름)는 스토어에 한 번 올리면 바꿀 수 없다
export const ANDROID_PACKAGE = 'com.imnewsroom.app'

// 앱 서명 지문(SHA-256). 공개 정보다 (비밀번호·키 파일이 아니다)
//   ① 앱 만들 때 받은 서명 키(업로드 키) 지문  ② 플레이 콘솔 → 앱 무결성 → 앱 서명 키 지문
//   둘 다 넣어야 스토어에서 받은 앱과 직접 설치한 시험 앱 모두 주소창 없이 열린다
export const ANDROID_CERT_SHA256: string[] = [
  // ① 업로드 키 (PWABuilder에서 만든 signing.keystore)
  'AD:16:13:91:79:CC:D0:4E:8E:BC:56:56:E3:24:95:1F:A6:78:FA:7D:4E:20:1B:48:26:6A:E5:73:CF:A5:68:37',
]
