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

// ───────── 발행 일시 (한국 시간 기준) ─────────
const KST = 9 * 3600_000
// ISO → <input type="datetime-local"> 값 (한국 시간)
export function toKstInput(iso: string | null | undefined) {
  if (!iso) return ''
  return new Date(Date.parse(iso) + KST).toISOString().slice(0, 16)
}
// <input type="datetime-local"> 값(한국 시간) → ISO
export function fromKstInput(v: string) {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? new Date(`${v}:00+09:00`).toISOString() : null
}
// 발행했지만 공개 시각이 아직 안 된 기사 (예약 발행)
export function isScheduled(a: { status?: string | null; published_at?: string | null }) {
  return a.status === 'published' && !!a.published_at && Date.parse(a.published_at) > Date.now()
}
