// 메뉴 주소(슬러그) 만들기: 한글 이름은 로마자로 바꿔 쓴다 (예: 교육 → gyoyuk, 보건 복지 → bogeon-bokji)
//   국어의 로마자 표기법 기본 규칙만 쓴다 (받침이 다음 소리에 미치는 변화는 따지지 않는다)
const CHO = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h']
const JUNG = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i']
const JONG = ['', 'k', 'k', 'k', 'n', 'n', 'n', 't', 'l', 'k', 'm', 'l', 'l', 'l', 'p', 'l', 'm', 'p', 'p', 't', 't', 'ng', 't', 't', 'k', 't', 'p', 't']

export function romanize(s: string): string {
  let out = ''
  for (const ch of s) {
    const c = ch.charCodeAt(0) - 0xac00
    if (c < 0 || c > 11171) { out += ch; continue }
    out += CHO[Math.floor(c / 588)] + JUNG[Math.floor((c % 588) / 28)] + JONG[c % 28]
  }
  return out
}

export function toSlug(name: string): string {
  return romanize(name.trim()).toLowerCase()
    .replace(/[·・,/&+]+/g, '-').replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '')
    .slice(0, 40)
}

export const isSlug = (s: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)
