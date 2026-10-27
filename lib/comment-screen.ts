// 댓글 자동 검사: 걸리면 설정과 상관없이 "승인 대기"로 잡아 둔다 (편집국 → 댓글 → 승인 대기에 이유가 보인다)
//   욕설 목록은 짧게 시작한다. 편집국이 숨긴 댓글을 보면서 단어를 늘려 간다
const KO_BAD = ['씨발', '시발', '씹', '병신', '개새끼', '새끼', '좆', '지랄', '미친놈', '미친년', '느금', '닥쳐', '꺼져', '죽어라', '뒤져', '애미', '애비', '창녀', '걸레', '쓰레기같']
const EN_BAD = ['fuck', 'shit', 'bitch', 'asshole', 'cunt', 'dick', 'bastard', 'slut', 'whore', 'nigger', 'nigga', 'faggot', 'retard', 'kill yourself', 'kys']

export type HoldReason = 'link' | 'contact' | 'profanity' | 'shouting' | 'repeat'

export function screenComment(text: string): HoldReason | null {
  const t = text.trim()
  if (/https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|kr|co|io|ly|me)\b/i.test(t)) return 'link'
  if (/[\w.+-]+@[\w-]+\.[\w.-]+/.test(t) || /(\+?\d{1,3}[ -]?)?\(?\d{2,4}\)?[ -.]?\d{3,4}[ -.]?\d{4}\b/.test(t)) return 'contact'
  // 글자 사이에 공백·기호를 끼워 피하는 경우를 위해 한글·영문자만 남겨 다시 본다
  const flat = t.toLowerCase().replace(/[^a-z가-힣]/g, '')
  const spaced = t.toLowerCase().replace(/\s+/g, ' ')
  if (KO_BAD.some((w) => flat.includes(w)) || EN_BAD.some((w) => (w.includes(' ') ? spaced.includes(w) : new RegExp(`\\b${w}`, 'i').test(spaced) || flat.includes(w)))) return 'profanity'
  const letters = t.replace(/[^A-Za-z]/g, '')
  if (letters.length >= 20 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.7) return 'shouting'
  if (/(.)\1{9,}/.test(t) || /\b(\w{2,})\b(?:\s+\1\b){4,}/i.test(t)) return 'repeat'
  return null
}

export const HOLD_LABEL: Record<string, [ko: string, en: string]> = {
  link: ['링크 포함', 'Contains a link'],
  contact: ['연락처·이메일 포함', 'Contains contact details'],
  profanity: ['욕설·비방 표현', 'Possible profanity or abuse'],
  shouting: ['대문자 고함', 'ALL CAPS'],
  repeat: ['도배·반복', 'Repetition or spam'],
}
