import { PRODUCT } from './product'
import { noticeMail, sendMails, mailReady } from './mail'

// 편집국 초대 메일: 초대한 이메일(또는 같은 주소의 구글 계정)로 가입하면 바로 승인되어 들어온다
//   메일 설정 전이면 보내지 않고 false (화면에서 가입 주소를 직접 알려 달라고 안내)
export async function sendInviteMail(a: { email: string; fullName?: string | null; outletName: string; role: string }): Promise<boolean> {
  if (!mailReady()) return false
  const signup = `${PRODUCT.appUrl}/signup`
  const { html, text } = noticeMail({
    title: `${a.outletName} 편집국에 초대되었습니다`,
    lines: [
      `${a.fullName ? `${a.fullName}님, ` : ''}${a.outletName}에서 ${PRODUCT.name} 편집국 ${a.role}로 초대했습니다.`,
      `아래 버튼을 눌러 이 메일 주소(${a.email})로 가입하면 바로 승인되어 편집국에 들어갑니다. 같은 주소의 구글 계정으로 가입해도 됩니다.`,
      '가입할 때 서비스 이용약관과 개인정보 수집·이용 동의를 받습니다. 초대를 받은 적이 없다면 이 메일은 무시해 주세요.',
    ],
    button: { label: '편집국 가입하기', url: signup },
    footer: `${PRODUCT.name} 편집국 초대 메일입니다.`,
  })
  const r = await sendMails([{ to: a.email, subject: `[${PRODUCT.name}] ${a.outletName} 편집국 초대`, html, text, tag: 'invite' }]).catch(() => null)
  return !!r && r.sent > 0
}
