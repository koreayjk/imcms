// 매체 저장 용량 (사진 + 영상 합계). 요금제 표(lib/pricing.ts)의 "저장 용량"과 같은 숫자를 쓴다
//   요금제 없음(운영사 자체 매체)·엔터프라이즈(맞춤)는 한도 없음
const GB = 1024 * 1024 * 1024

const PLAN_STORAGE_GB: Record<string, number> = { basic: 30, standard: 60, premium: 100 }

export function storageLimitBytes(plan: string | null | undefined): number | null {
  const gb = plan ? PLAN_STORAGE_GB[plan] : undefined
  return gb ? gb * GB : null
}

export function formatBytes(n: number) {
  if (n >= GB) return `${(n / GB).toFixed(n >= 10 * GB ? 0 : 1)}GB`
  if (n >= 1024 * 1024) return `${Math.round(n / (1024 * 1024))}MB`
  return `${Math.max(0, Math.round(n / 1024))}KB`
}

// 본문 속 영상 주소 (중복 없이, 나온 순서대로)
export function bodyVideos(html: string | null | undefined) {
  const out: string[] = []
  for (const m of (html ?? '').matchAll(/<video\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi)) {
    if (!out.includes(m[1])) out.push(m[1])
  }
  return out
}
