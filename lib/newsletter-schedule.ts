// 뉴스레터 자동 발송 예약 (supabase/newsletter-schedule.sql). 시각은 모두 한국 시간 정시
export type ScheduleKind = 'once' | 'weekly' | 'biweekly' | 'monthly'
export type NewsletterSchedule = {
  id: string
  outlet_id: string
  kind: ScheduleKind
  send_on: string | null
  weekday: number | null
  month_day: number | null
  hour: number
  article_count: number
  section_slug: string | null
  subject_template: string
  intro: string | null
  enabled: boolean
  next_run_at: string | null
  last_run_at: string | null
  last_result: string | null
}

export const KIND_LABEL: Record<ScheduleKind, string> = { once: '한 번만', weekly: '매주', biweekly: '2주마다', monthly: '매월' }
export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const KST = 9 * 3600e3
// 한국 날짜·시각 → 실제 시각
const kstAt = (y: number, m: number, d: number, h: number) => new Date(Date.UTC(y, m, d, h) - KST)
const kstParts = (t: Date) => {
  const k = new Date(t.getTime() + KST)
  return { y: k.getUTCFullYear(), m: k.getUTCMonth(), d: k.getUTCDate(), wd: k.getUTCDay() }
}

// after 다음(초과) 첫 회차. prev: 바로 전 회차(2주마다 계산용). 없으면 null (한 번만 보내기가 지났을 때)
export function nextRun(s: Pick<NewsletterSchedule, 'kind' | 'send_on' | 'weekday' | 'month_day' | 'hour'>, after: Date, prev?: Date | null): Date | null {
  const h = s.hour
  if (s.kind === 'once') {
    if (!s.send_on) return null
    const [y, m, d] = s.send_on.split('-').map(Number)
    const t = kstAt(y, m - 1, d, h)
    return t > after ? t : null
  }
  if (s.kind === 'monthly') {
    const day = s.month_day ?? 1
    const p = kstParts(after)
    for (let i = 0; i < 3; i++) {
      const t = kstAt(p.y, p.m + i, day, h)
      if (t > after) return t
    }
    return null
  }
  const wd = s.weekday ?? 1
  if (s.kind === 'biweekly' && prev) {
    let t = new Date(prev.getTime() + 14 * 864e5)
    while (t <= after) t = new Date(t.getTime() + 14 * 864e5)
    return t
  }
  const p = kstParts(after)
  for (let i = 0; i < 8; i++) {
    const t = kstAt(p.y, p.m, p.d + i, h)
    if (kstParts(t).wd === wd && t > after) return t
  }
  return null
}

// 한 달에 최대 몇 번 나가는지 (요금제 한도와 비교)
export const perMonthOf = (kind: ScheduleKind) => (kind === 'weekly' ? 5 : kind === 'biweekly' ? 3 : 1)

// 제목: {매체} {날짜} 를 채운다 (날짜는 '10월 20일')
export function renderSubject(template: string, outletName: string, at: Date) {
  const p = kstParts(at)
  return template.replace(/\{매체\}/g, outletName).replace(/\{날짜\}/g, `${p.m + 1}월 ${p.d}일`).slice(0, 150)
}

export function describeSchedule(s: Pick<NewsletterSchedule, 'kind' | 'send_on' | 'weekday' | 'month_day' | 'hour'>) {
  const time = `${s.hour < 12 ? '오전' : '오후'} ${s.hour % 12 === 0 ? 12 : s.hour % 12}시`
  if (s.kind === 'once') return `${s.send_on ?? ''} ${time}`
  if (s.kind === 'monthly') return `매월 ${s.month_day ?? 1}일 ${time}`
  return `${KIND_LABEL[s.kind]} ${WEEKDAYS[s.weekday ?? 1]}요일 ${time}`
}

export const formatKst = (iso: string) => {
  const t = new Date(iso)
  const p = kstParts(t)
  const h = new Date(t.getTime() + KST).getUTCHours()
  return `${p.m + 1}월 ${p.d}일(${WEEKDAYS[p.wd]}) ${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}시`
}
