# IM 뉴스룸 아이폰 앱 (Xcode)

편집국(`https://app.imnewsroom.com`)을 앱 안 웹 화면(WKWebView)으로 여는 앱입니다.
IM VOCA처럼 Xcode에서 바로 만듭니다. 이 폴더의 파일은 웹 서비스(Vercel) 배포와 상관없습니다.

## 들어 있는 파일

| 파일 | 하는 일 |
|---|---|
| `IMNewsroom/IMNewsroomApp.swift` | 앱 시작점 |
| `IMNewsroom/ContentView.swift` | 편집국 화면, 바깥 링크는 사파리로 열기, 당겨서 새로고침, 오른쪽으로 밀어 뒤로 가기, 인터넷 끊김 안내, 웹의 확인창(alert·confirm)을 아이폰 알림창으로 |
| `IMNewsroom/AppIcon-1024.png` | 앱 아이콘 (1024×1024, 투명 없음) |

앱은 User-Agent 끝에 `IMNewsroomApp/1.0`을 붙입니다. 웹(`lib/ios-app.ts`)은 이 글자를 보고 앱 안에서만 아래를 숨깁니다.
- 구글 로그인 단추: 애플 심사 4.8항(다른 회사 로그인을 넣으면 Apple 로그인도 요구). 구글도 앱 안 웹 화면에서는 로그인을 막습니다.
- 청구서 결제·자동결제 등록·"지금 결제하기" 단추: 애플 심사 3.1항(앱 안 결제)

## Xcode에서 만들기

1. **File → New → Project → iOS → App**
   - Product Name: `IMNewsroom`
   - Team: 회사 개발자 계정
   - Organization Identifier: `com.imnewsroom` → Bundle Identifier가 `com.imnewsroom.app`이 되도록 Product Name 칸을 `app`으로 하거나, 만든 뒤 Bundle Identifier를 직접 `com.imnewsroom.app`으로 고칩니다
   - Interface: SwiftUI, Language: Swift
2. 만들어진 `ContentView.swift`와 `IMNewsroomApp.swift`(이름이 `IMNewsroomApp.swift` 또는 `appApp.swift`)를 이 폴더의 두 파일 내용으로 바꿉니다. `@main`이 붙은 파일은 하나만 있어야 합니다.
3. **Assets → AppIcon**에 `AppIcon-1024.png`를 끌어다 놓습니다 (Single Size).
4. 타깃 → **General**
   - Display Name: `IM 뉴스룸`
   - Minimum Deployments: iOS 16.0
   - Supported Destinations: **iPhone만** (iPad를 빼야 아이패드 스크린샷이 필요 없습니다)
   - Version `1.0`, Build `1`
5. 타깃 → **Info**에 항목 추가 (+ 단추)

   | Key | 값 |
   |---|---|
   | Privacy - Camera Usage Description | 기사 사진을 찍어 올릴 때 카메라를 사용합니다. |
   | Privacy - Photo Library Usage Description | 기사에 넣을 사진을 고를 때 사진 보관함을 사용합니다. |
   | Privacy - Microphone Usage Description | 기사에 넣을 영상을 촬영할 때 소리를 녹음하기 위해 마이크를 사용합니다. |
   | App Uses Non-Exempt Encryption | NO |

6. 시뮬레이터나 아이폰을 연결해 ▶ 실행 → 로그인 화면에 **구글 로그인 단추가 없으면** 앱 표시가 제대로 된 것입니다.
7. **Product → Archive → Distribute App → App Store Connect → Upload**
8. 10~30분 뒤 App Store Connect → TestFlight에 빌드가 나타나면 아이폰에서 시험 → 버전 화면에서 빌드를 골라 심사 제출

## 심사에서 앱이 꺼진 일 (2.1(a), 2026-10-21 반려) — 마이크 설명 문구가 빠져 있었다

고객센터 → 업무요청 → 파일 선택 → "사진 또는 비디오 촬영" → 비디오를 고르면, 웹 화면이 카메라와 함께 마이크를 쓰려 하는데 Info.plist에 `NSMicrophoneUsageDescription`이 없으면 iOS가 앱을 바로 끈다 (충돌 기록: `TCC … without a usage description … NSMicrophoneUsageDescription`).
위 5번 표의 **Microphone** 줄을 반드시 넣고, 다시 올릴 때 Build 번호를 올린다 (이번 반려 빌드는 Build 3 → **Build 4**).
올리기 전에 실제 아이폰이나 아이패드에서 확인: 업무요청 → 파일 선택 → 사진 또는 비디오 촬영 → 비디오 → 마이크 허용 창이 뜨고, 허용하면 촬영되고 앱이 꺼지지 않아야 한다. 기사 쓰기의 영상 올리기(촬영)도 같은 경로다.

## 심사에서 걸린 일 (3.1.1 · 3.1.3(c) 기업용 서비스, 2차 답변)

애플 문구: "기업용 서비스인데 개인·소비자에게도 앱 안 결제 없이 팔릴 수 있다 → 조직·직원 대상으로만 제공하거나, 개인용이면 인앱결제를 쓰라."
우리 답: **조직 전용으로 고친다.** 앱 안에서 개인이 가입·체험을 시작하거나 결제할 수 없게 했다.
- 앱 안(User-Agent에 IMNewsroomApp)에서는 로그인 화면의 "회원가입" 링크를 숨기고 "언론사 소속 구성원 전용" 안내를 보인다 (`lib/ios-app.ts`, `app/login/page.tsx`)
- 앱 안에서 `/signup`, `/trial`(1주일 무료 체험)로 직접 들어가도 가입·체험 양식 대신 같은 안내만 나온다 (서버에서 확인)
- 결제·자동결제 단추, 구글 로그인은 이미 앱에서 숨김. 가격표·요금제는 앱 안에 없다
- 계정은 소속 언론사 발행인이 초대 메일로 만든다. 서비스는 언론사와 계약해서 세금계산서·청구서로 정산한다(앱 밖)
- 앱 안에서 바깥 구매 안내(요금·결제 링크)는 넣지 않는다 (미국 외 스토어에서는 외부 결제 안내 자체가 3.1.1 위반)

다시 올릴 때: 웹(Vercel)은 이미 배포된 것으로 반영된다. 앱 빌드는 바꾸지 않아도 되지만, 답변을 남기고 같은 빌드를 다시 제출한다 (바이너리 변경이 없으면 Resolution Center에 답글만 달고 "Submit"으로 다시 심사 요청).

### App Store Connect 답글 (영어, 그대로 붙여 넣기)

> Thank you for the additional review.
>
> IM Newsroom is an enterprise (B2B) editorial system sold only to news organizations (media companies) under a contract and invoiced outside the app. It is not sold to individual consumers or for family use, and the app contains no purchase, subscription or pricing flow.
>
> To make this clear in the app, we have updated our service so that, inside the iOS app:
> 1. Self-registration and the free-trial sign-up are no longer available. The "Sign up" link is hidden on the login screen and the sign-up / trial pages show only a notice that the app is for members of a contracted news organization.
> 2. Accounts are created only by invitation from the publisher (administrator) of the customer organization. Users are employees and reporters of that organization.
> 3. Payment buttons, card registration and automatic-payment setup are hidden in the app, as before. Invoices are paid by the organization outside the app.
>
> Therefore the app provides its services only to organizations and their employees (Guideline 3.1.3(c)), and In-App Purchase is not required. These changes are live on our web service now; please re-review the same build.
>
> Demo account: (심사용 계정은 App Review Information 칸에 이미 적혀 있는 것을 그대로 쓴다)

## 알아 둘 점

- 청구서의 "PDF로 저장"(인쇄)은 앱 안에서 동작하지 않을 수 있습니다. 청구서는 웹 브라우저에서 저장하면 됩니다.
- 가입 확인·비밀번호 재설정 메일의 링크는 사파리에서 열립니다. 사파리에서 끝낸 뒤 앱에서 다시 로그인하면 됩니다.
- 다음 버전을 올릴 때는 Build 번호를 1씩 올립니다(Version은 기능이 바뀔 때).
