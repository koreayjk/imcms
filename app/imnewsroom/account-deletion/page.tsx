import type { Metadata } from 'next'
import { ISSUER, PRODUCT } from '@/lib/product'
import type { PolicySection } from '@/lib/service-terms'
import PolicyPageShell from '@/components/product/PolicyPageShell'

// 계정 삭제 안내 (구글 플레이 정책: 앱을 지운 뒤에도 웹에서 계정 삭제를 요청할 수 있어야 한다)
export const metadata: Metadata = { title: `계정 삭제 요청 — ${PRODUCT.name}` }

const SECTIONS: PolicySection[] = [
  { title: '들어가며', body: [`${PRODUCT.name} 편집국(앱 “IM 뉴스룸” 포함) 계정이나 일부 자료를 지우고 싶을 때 아래 방법으로 요청해 주세요. 요청을 받으면 7일 안에 처리하고 가입한 이메일로 알려 드립니다. 운영: ${ISSUER.legalName ?? PRODUCT.name}`] },
  {
    title: '1. 편집국에서 요청하기',
    body: [[
      '아래 순서로 요청합니다. 요청은 고객센터에 남고, 처리 상황도 그곳에서 볼 수 있습니다.',
      '앱 또는 app.imnewsroom.com 에 로그인',
      '“내 정보” 열기 (휴대폰: 아래 “더보기” → 내 이름 / PC: 오른쪽 위 내 이름)',
      '맨 아래 “계정 삭제 요청” → “계정 삭제 요청 보내기” 누르기',
    ]],
  },
  {
    title: '2. 로그인할 수 없을 때',
    body: [`${ISSUER.contact ?? '운영팀 이메일'} 으로 가입한 이메일 주소, 이름, 소속 언론사를 적어 “계정 삭제 요청”이라는 제목으로 메일을 보내 주세요. 본인 확인을 위해 가입한 이메일 주소로 보내 주셔야 합니다.`],
  },
  {
    title: '3. 계정은 두고 일부 자료만 지우기',
    body: [
      [
        '아래 자료는 편집국에서 직접 지울 수 있습니다.',
        '내가 쓴 기사: 기사목록에서 기사를 고르고 “삭제”',
        '고객센터 업무요청: 요청 화면의 “삭제”',
        '개선 요청 글과 댓글: 글 화면의 “삭제”',
        '이름: “내 정보”에서 고치기',
        '다른 기기의 로그인: “내 정보 → 다른 기기 모두 로그아웃”',
      ],
      `그 밖의 자료(로그인 기록, 올린 사진 등)는 고객센터 업무요청이나 ${ISSUER.contact ?? '운영팀 이메일'} 으로 지울 자료를 적어 요청해 주세요. 7일 안에 지우고 알려 드립니다.`,
    ],
  },
  {
    title: '4. 계정을 지우면 지워지는 정보',
    body: [[
      '이름, 이메일 주소, 소속 매체와 직급, 구글 로그인 연결 정보',
      '로그인 기록, 알림 설정, 2단계 인증 정보',
      '본인이 올린 고객센터 업무요청과 첨부파일',
    ]],
  },
  {
    title: '5. 남는 정보',
    body: [[
      '아래 정보는 지우지 않거나, 법령이 정한 기간 동안 따로 보관합니다.',
      '쓴 기사: 언론사가 발행한 기사이므로 기자명과 함께 매체에 남습니다. 기사 삭제는 소속 언론사에 요청해 주세요.',
      '계약·결제 기록: 전자상거래법에 따라 5년, 불만·분쟁 처리 기록은 3년 동안 따로 보관한 뒤 지웁니다.',
    ]],
  },
]

export default function AccountDeletionPage() {
  return <PolicyPageShell title="계정 삭제 요청" sections={SECTIONS} other={{ href: `${PRODUCT.path}/privacy`, label: '개인정보처리방침' }} />
}
