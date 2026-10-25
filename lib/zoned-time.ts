// 나라(시간대)별 날짜·시각 ↔ 절대 시각(ISO). 예약 오픈처럼 "그 나라 시간으로 몇 시"를 정할 때 쓴다 (서버·브라우저 어디서나 동작)

export const OPEN_ZONES: { tz: string; label: string }[] = [
  { tz: 'Asia/Seoul', label: '한국 (서울)' },
  { tz: 'Asia/Tokyo', label: '일본 (도쿄)' },
  { tz: 'Asia/Shanghai', label: '중국 (상하이)' },
  { tz: 'Asia/Bangkok', label: '태국·베트남 (방콕)' },
  { tz: 'Asia/Manila', label: '필리핀 (마닐라)' },
  { tz: 'Asia/Singapore', label: '싱가포르' },
  { tz: 'Australia/Sydney', label: '호주 (시드니)' },
  { tz: 'Europe/London', label: '영국 (런던)' },
  { tz: 'Europe/Paris', label: '프랑스·독일 (파리)' },
  { tz: 'America/New_York', label: '미국 동부 (뉴욕)' },
  { tz: 'America/Chicago', label: '미국 중부 (시카고·텍사스)' },
  { tz: 'America/Denver', label: '미국 산악 (덴버)' },
  { tz: 'America/Los_Angeles', label: '미국 서부 (로스앤젤레스)' },
  { tz: 'Pacific/Honolulu', label: '하와이' },
  { tz: 'UTC', label: '협정 세계시 (UTC)' },
]
export const isOpenZone = (tz: unknown): tz is string => typeof tz === 'string' && OPEN_ZONES.some((z) => z.tz === tz)

// 그 시각(UTC ms)에 이 시간대가 UTC보다 몇 ms 앞서는가
function offsetMs(utcMs: number, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]))
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(utcMs / 1000) * 1000
}

// "2026-10-26T09:00" (그 나라의 벽시계 시각) → 절대 시각 ISO. 형식이 틀리면 null
export function zonedToIso(local: string, tz: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local)
  if (!m || !isOpenZone(tz)) return null
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5])
  let t = asUtc - offsetMs(asUtc, tz)
  t = asUtc - offsetMs(t, tz) // 서머타임 경계에서 한 번 더 맞춘다
  return Number.isFinite(t) ? new Date(t).toISOString() : null
}

// 절대 시각 ISO → 그 나라의 "2026-10-26T09:00"
export function isoToZoned(iso: string | undefined | null, tz: string): string {
  if (!iso || !Number.isFinite(Date.parse(iso)) || !isOpenZone(tz)) return ''
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`
}

// 사람이 읽는 표기: 날짜·시각과 시간대 이름을 나눠 돌려준다 (서버 ICU 에 따라 "오전"이 "AM"으로 나오지 않게 직접 만든다)
export function formatZonedParts(iso: string, tz: string, lang: 'ko' | 'en' = 'ko') {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  const h = Number(p.hour), mm = p.minute
  const z = OPEN_ZONES.find((x) => x.tz === tz)
  if (lang === 'en') {
    const month = new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'long' }).format(new Date(iso))
    return { date: `${month} ${p.day}, ${p.year}, ${h % 12 === 0 ? 12 : h % 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`, zone: tz }
  }
  return { date: `${p.year}년 ${p.month}월 ${p.day}일 ${h < 12 ? '오전' : '오후'} ${h % 12 === 0 ? 12 : h % 12}:${mm}`, zone: `${z ? z.label.replace(/ \(.*\)$/, '') : tz} 시간` }
}

export function formatZoned(iso: string, tz: string, lang: 'ko' | 'en' = 'ko') {
  const { date, zone } = formatZonedParts(iso, tz, lang)
  return `${date} (${zone})`
}
