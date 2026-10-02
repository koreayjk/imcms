import { createHmac } from 'crypto'
import { htmlToText } from './press'

// 법적 검수한 글자(제목·부제·본문)의 서명된 해시. 서버에서만 쓴다
//   띄어쓰기·줄바꿈만 다른 경우는 같은 글로 본다. 서버 비밀값으로 서명해 두어, 검수 결과를 직접 만들어 저장해도 "검수 완료"로 통하지 않게 한다
export function legalContentHash(title: string, subtitle: string, text: string) {
  const norm = (v: string) => v.replace(/\s+/g, ' ').trim()
  return createHmac('sha256', `legal:${process.env.PAYMENT_DB_SECRET ?? ''}`).update([title, subtitle, text].map(norm).join('\u0000')).digest('hex').slice(0, 32)
}

export const legalHashOfHtml = (title: string, subtitle: string, html: string) => legalContentHash(title, subtitle, htmlToText(html))
