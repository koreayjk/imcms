// 정책 페이지(개인정보처리방침·청소년보호정책·이메일무단수집거부)의 시행일
//   정책 문안을 정한 날(base)과 이 매체를 연 날 중 더 늦은 날을 보여 준다
//   (새로 연 매체가 열기도 전의 날짜로 나오지 않게. 예전에 연 매체는 문안을 정한 날 그대로)
const EN_MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'Jun.', 'Jul.', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.']

const kstDay = (iso: string) => new Date(new Date(iso).getTime() + 9 * 3600e3).toISOString().slice(0, 10)

export function policyEffective(site: { lang?: string; createdAt?: string | null }, base: string) {
  let day = base
  if (site.createdAt && !Number.isNaN(Date.parse(site.createdAt))) {
    const opened = kstDay(site.createdAt)
    if (opened > day) day = opened
  }
  const [y, m, d] = day.split('-').map(Number)
  return site.lang === 'en' ? `${EN_MONTHS[m - 1]} ${d}, ${y}` : `${y}년 ${m}월 ${d}일`
}
