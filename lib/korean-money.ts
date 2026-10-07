// 금액을 한글로 (견적서 '일금 삼백삼십만원정'). 서류 관례대로 '일백일십만'처럼 일을 빼지 않는다
const DIGITS = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
const SMALL = ['', '십', '백', '천']
const BIG = ['', '만', '억', '조']

export function koreanMoney(n: number) {
  let v = Math.round(Math.abs(n))
  if (!v) return '영'
  const groups: string[] = []
  for (let g = 0; v > 0; g++, v = Math.floor(v / 10000)) {
    const part = v % 10000
    if (!part) continue
    let s = ''
    for (let i = 3; i >= 0; i--) {
      const d = Math.floor(part / 10 ** i) % 10
      if (d) s += DIGITS[d] + SMALL[i]
    }
    groups.unshift(s + BIG[g])
  }
  return groups.join('')
}
