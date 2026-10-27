// 로그인 기록에 보여줄 기기·브라우저 이름 (브라우저가 보내는 User-Agent 글자를 짧게 줄인다)
export function deviceLabel(ua: string | null | undefined, lang?: 'ko' | 'en') {
  const en = lang === 'en'
  const s = ua ?? ''
  if (!s) return en ? 'Unknown device' : '알 수 없는 기기'
  const os =
    /iPhone/.test(s) ? 'iPhone'
    : /iPad/.test(s) ? 'iPad'
    : /Android/.test(s) ? (/Mobile/.test(s) ? (en ? 'Android phone' : 'Android 휴대폰') : (en ? 'Android tablet' : 'Android 태블릿'))
    : /Windows/.test(s) ? 'Windows'
    : /Macintosh|Mac OS X/.test(s) ? 'Mac'
    : /CrOS/.test(s) ? 'Chromebook'
    : /Linux/.test(s) ? 'Linux'
    : (en ? 'Other device' : '기타 기기')
  const browser =
    /KAKAOTALK/i.test(s) ? (en ? 'KakaoTalk' : '카카오톡')
    : /NAVER\(inapp|Whale/.test(s) ? (/Whale/.test(s) ? (en ? 'Whale' : '웨일') : (en ? 'Naver app' : '네이버 앱'))
    : /SamsungBrowser/.test(s) ? (en ? 'Samsung Internet' : '삼성 인터넷')
    : /Edg\//.test(s) ? 'Edge'
    : /OPR\/|Opera/.test(s) ? 'Opera'
    : /Firefox|FxiOS/.test(s) ? 'Firefox'
    : /Chrome|CriOS/.test(s) ? 'Chrome'
    : /Safari/.test(s) ? 'Safari'
    : (en ? 'Browser' : '브라우저')
  return `${os} · ${browser}`
}

// 마지막 접속이 1년보다 오래됐는가 (접속한 적이 없으면 가입일로 본다)
export const DORMANT_DAYS = 365
export function isDormant(lastSeen: string | null | undefined, createdAt: string) {
  return Date.now() - new Date(lastSeen ?? createdAt).getTime() > DORMANT_DAYS * 86_400_000
}
