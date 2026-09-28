const TZ = 'Asia/Seoul'

function parts(iso: string) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date(iso)).map((x) => [x.type, x.value])
  )
  return { y: p.year, m: p.month, d: p.day, hh: p.hour, mm: p.minute }
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return ''
  const { y, m, d } = parts(iso)
  return `${y}.${m}.${d}`
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return ''
  const { y, m, d, hh, mm } = parts(iso)
  return `${y}.${m}.${d} ${hh}:${mm}`
}

export function formatShort(iso: string | null | undefined) {
  if (!iso) return ''
  const t = parts(iso)
  const now = parts(new Date().toISOString())
  return t.y === now.y && t.m === now.m && t.d === now.d ? `${t.hh}:${t.mm}` : `${t.m}.${t.d}`
}

export function formatToday() {
  return new Date().toLocaleDateString('ko-KR', {
    timeZone: TZ, year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  })
}
