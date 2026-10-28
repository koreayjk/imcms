// 편집국 통계의 기간 경계 (그 매체의 시간대 기준 날짜, 'YYYY-MM-DD')
export type StatsPeriod = 'today' | 'week' | 'month' | 'year' | 'all'
export const PERIODS: StatsPeriod[] = ['today', 'week', 'month', 'year', 'all']
export const parsePeriod = (v: string | undefined): StatsPeriod => (PERIODS.includes(v as StatsPeriod) ? (v as StatsPeriod) : 'week')

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`

export function periodBounds(tz = 'Asia/Seoul') {
  let today: string
  try { today = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date()) } catch { today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date()) }
  const [y, m, d] = today.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  const back = (t.getUTCDay() + 6) % 7 // 월요일 시작
  const week = new Date(t); week.setUTCDate(t.getUTCDate() - back)
  const ago30 = new Date(t); ago30.setUTCDate(t.getUTCDate() - 29)
  return { today, week: ymd(week), month: `${y}-${pad(m)}-01`, year: `${y}-01-01`, ago30: ymd(ago30), days30: Array.from({ length: 30 }, (_, i) => { const x = new Date(ago30); x.setUTCDate(ago30.getUTCDate() + i); return ymd(x) }) }
}
