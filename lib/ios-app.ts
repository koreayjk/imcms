// 아이폰 앱(App Store, Xcode로 만든 WKWebView 앱) 안에서 열린 편집국
//   앱이 User-Agent 끝에 IOS_APP_UA 를 붙인다 (ios/IMNewsroom/ContentView.swift 의 applicationNameForUserAgent)
//   앱 안에서는 애플 심사 기준에 맞춰 구글 로그인(4.8항)·결제 단추(3.1항)를 숨긴다
//   숨길 곳에 className "ios-app-hide", 앱에서만 보일 안내에 "ios-app-only" (app/globals.css)
export const IOS_APP_UA = 'IMNewsroomApp'

// 서버에서 앱 안 접속인지 확인 (애플 심사 3.1.3(c): 앱은 계약한 언론사 구성원만 쓰게 하고, 개인 가입·체험 신청은 앱 안에서 열지 않는다)
export const isIosAppUA = (ua: string | null | undefined) => !!ua && ua.includes(IOS_APP_UA)

export const IOS_ORG_ONLY_NOTICE = '이 앱은 IM 뉴스룸을 쓰는 언론사 소속 구성원 전용입니다. 계정은 소속 언론사의 발행인이 초대 메일로 만들어 드립니다.'

// <html> 에 in-ios-app 을 붙이는 짧은 스크립트 (화면이 그려지기 전에 실행)
export const IOS_APP_SCRIPT = `try{if(navigator.userAgent.indexOf('${IOS_APP_UA}')>-1)document.documentElement.classList.add('in-ios-app')}catch(e){}`
