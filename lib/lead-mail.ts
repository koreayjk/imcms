// 신청 고객에게 보내는 안내 메일 문안 (고객 상담 화면 "메일 보내기"에서 불러온다. 보내기 전에 고쳐 쓸 수 있다)
import { PRODUCT } from './product'
import { SETUP_FEE, SETUP_WAIVER_MONTHS, won } from './pricing'
import { ONBOARDING_STEPS, ONBOARDING_URL } from './onboarding-guide'

type LeadInfo = { company: string; contact_name: string; domain?: string | null }

export type LeadMailTemplate = { key: string; label: string; subject: string; body: string }

// Vercel Domains 화면의 권장 DNS 값 (바뀔 수 있다: 보내기 전에 화면 값과 같은지 확인한다. 예전 76.76.21.21 · cname.vercel-dns.com 도 당분간 작동)
export const DNS_A = '216.150.1.1'
export const DNS_CNAME = '13a356fc85cf917a.vercel-dns-017.com'

const name = (l: LeadInfo) => `${l.contact_name} 대표님`

export function leadMailTemplates(l: LeadInfo): LeadMailTemplate[] {
  const addr = l.domain ? l.domain : '신청해 주신 도메인'
  return [
    {
      key: 'hello',
      label: '신청 받았습니다 (첫 연락)',
      subject: `[${PRODUCT.name}] ${l.company} 신청 감사합니다`,
      body: `${name(l)}, 안녕하세요.\n${PRODUCT.name}입니다. ${l.company} 신청 감사합니다.\n\n진행을 위해 두 가지만 확인하고 싶습니다.\n- 지금 쓰시는 기사 관리 프로그램이 있는지 (있으면 기사·사진을 옮겨 드립니다)\n- 홈페이지에 넣을 로고, 대표 색, 메뉴(섹션) 구성\n\n편하신 시간에 통화하셔도 좋고, 이 메일에 회신해 주셔도 됩니다.\n\n감사합니다.\n${PRODUCT.name} 운영팀 드림`,
    },
    {
      key: 'schedule',
      label: '개통 일정 안내 (며칠 안에 무엇이)',
      subject: `[${PRODUCT.name}] ${l.company} 개통 일정 안내`,
      body: `${name(l)}, 안녕하세요.\n${PRODUCT.name}입니다. ${l.company} 개통은 아래 순서로 진행합니다. 일정은 영업일 기준 보통의 목표이고, 자료나 도메인 설정이 늦어지면 함께 늦어질 수 있습니다.\n\n${ONBOARDING_STEPS.map((s, i) => `${i + 1}. ${s.title} (보통 ${s.days})\n- 저희: ${s.we.join(' ')}\n- 부탁드릴 일: ${s.you.join(' ')}\n- 끝나면: ${s.result}`).join('\n\n')}\n\n단계별 설명은 ${ONBOARDING_URL} 에서도 보실 수 있고, 편집국에 들어오시면 고객센터의 "개통 현황"에서 지금 어느 단계인지 확인하실 수 있습니다.\n\n궁금한 점은 이 메일에 회신해 주세요.\n\n감사합니다.\n${PRODUCT.name} 운영팀 드림`,
    },
    {
      key: 'domain',
      label: '도메인 연결·자료·세팅비 안내',
      subject: `[${PRODUCT.name}] ${l.company} 홈페이지 개통 준비 — 도메인 연결과 필요한 자료 안내`,
      body: `${name(l)}, 안녕하세요.\n${PRODUCT.name}입니다. 신청해 주셔서 감사합니다. ${l.company} 편집국과 홈페이지는 개설해 두었습니다. ${addr} 주소로 열리게 하려면 대표님 쪽에서 도메인 설정을 한 번 바꿔 주셔야 합니다.\n\n1. 도메인 연결 (약 10분)
도메인을 구입하신 업체(후이즈, 가비아, 호스팅케이알, 카페24 등)에 로그인하셔서 DNS 레코드(A·CNAME) 설정 메뉴로 가 주세요. 아래 두 줄을 넣으시면 됩니다.
- 호스트 @ (또는 비워 둠) · 종류 A · 값 ${DNS_A}
- 호스트 www · 종류 CNAME · 값 ${DNS_CNAME} (CNAME이 어려우시면 www도 A 레코드 ${DNS_A}로 하셔도 됩니다)

주의할 점
- @ 와 www 에 이미 다른 값(도메인 업체 기본 주소 등)이 들어 있으면 새로 추가하지 말고 그 줄을 수정해 주세요. 같은 호스트에 A와 CNAME이 함께 있으면 연결되지 않습니다.
- 후이즈는 "DNS 호스트 관리"(네임서버 등록 메뉴)가 아니라 "네임서버 고급설정" 안의 A·CNAME 레코드 설정입니다. "DNS 호스트 관리"에 넣으면 적용되지 않습니다.
- 메뉴 이름은 업체마다 조금 다르니, 막히시면 화면을 캡처해 보내 주시거나 통화로 같이 보면서 진행해도 됩니다. 설정 뒤 연결되기까지 보통 몇 분에서 몇 시간 걸리고, 그동안 주소가 안 열려도 정상입니다.
도메인 업체 로그인 정보(아이디·비밀번호)는 저희에게 보내지 마세요. 도메인은 대표님 소유라서 대표님이 직접 하시는 것이 안전합니다.

2. 홈페이지에 넣을 자료\n- 로고 파일(PNG, 배경이 투명하면 가장 좋습니다)과 대표 색\n- 메뉴(섹션) 구성: 예) 정치, 경제, 사회, 지역 등\n- 하단 표기 정보: 등록번호, 발행인, 편집인, 주소, 연락처\n- 지금 쓰시는 기사 관리 프로그램이 있으면 알려 주세요.\n\n3. 세팅비 안내 (확인 회신 부탁드립니다)\n베타 기간 신청으로 세팅비(${won(SETUP_FEE)})는 무료입니다. 이 면제는 개통일부터 ${SETUP_WAIVER_MONTHS}개월 이상 이용하시는 조건이며, ${SETUP_WAIVER_MONTHS}개월 안에 해지하시면 면제된 세팅비를 정산합니다. 이용약관 제8조·제10조에도 같은 내용이 있습니다. 확인하셨다는 회신을 부탁드립니다.\n\n도메인이 연결되면 홈페이지 주소와 편집국 로그인 방법을 안내해 드리겠습니다.\n\n감사합니다.\n${PRODUCT.name} 운영팀 드림`,
    },
    {
      key: 'opened',
      label: '개통 완료·편집국 로그인 안내',
      subject: `[${PRODUCT.name}] ${l.company} 홈페이지가 열렸습니다`,
      body: `${name(l)}, 안녕하세요.\n${PRODUCT.name}입니다. ${l.company} 홈페이지와 편집국이 준비되었습니다.\n\n- 홈페이지: ${l.domain ? `https://${l.domain.replace(/^https?:\/\//, '')}` : '(주소를 적어 주세요)'}\n- 편집국 로그인: ${PRODUCT.appUrl}\n\n초대 메일을 받으신 주소(또는 같은 주소의 구글 계정)로 가입하시면 바로 발행인으로 들어가실 수 있습니다. 기자·편집장 초대와 직급 설정, 기사 쓰는 방법은 편집국 안의 고객센터에 안내가 있고, 원하시면 통화로 1:1 안내도 해 드립니다.\n\n이용료 결제 안내\n- 이용료는 월 단위로 청구서가 발행되고, 청구서와 안내 메일이 결제 담당자(없으면 발행인)께 갑니다.\n- 카드를 등록해 두시면 청구서 발행 7일 뒤부터 납부 기한에 자동으로 결제되어 매달 신경 쓰실 일이 없습니다. 등록하지 않으시면 청구서에서 직접 카드 결제나 계좌이체를 하셔야 합니다.\n- 카드 등록: 편집국 로그인 → 고객센터 → 결제 정보 → 자동결제 (${PRODUCT.appUrl}/support/billing). 발행인·편집장 계정에서 컴퓨터 웹 브라우저로 하시면 됩니다. 카드 번호는 결제 대행사가 보관하고 저희는 알 수 없습니다.\n- 같은 화면에서 청구서·결제 담당자 이름과 이메일도 입력해 주세요.\n- 자동결제는 언제든 해지하실 수 있고, 해지하시면 청구서에서 직접 결제하시면 됩니다.\n\n궁금한 점은 이 메일에 회신해 주세요.\n\n감사합니다.\n${PRODUCT.name} 운영팀 드림`,
    },
  ]
}
