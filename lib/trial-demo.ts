import { unstable_cache } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import { isDemo } from '@/lib/public-data'
import { previewUrl } from '@/lib/product'

// 체험용 신문('IM 체험뉴스')의 번호: 소개 페이지에서 5가지 홈 배치를 실제 기사로 보여 줄 때 쓴다 (trial.sql 의 trial_outlet)
const trialId = unstable_cache(
  async (): Promise<string | null> => {
    const { data, error } = await createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!).rpc('trial_outlet')
    return !error && typeof data === 'string' ? data : null
  },
  ['trial-outlet-id'],
  { revalidate: 3600 }
)

// 홈 배치별 실제 화면 주소 (체험 신문이 없으면 null → 소개 페이지는 구조 그림만 보여 준다)
export async function layoutDemoUrls(keys: string[]): Promise<Record<string, string> | null> {
  if (isDemo) return Object.fromEntries(keys.map((k) => [k, `/?layout=${k}`]))
  const id = await trialId().catch(() => null)
  return id ? Object.fromEntries(keys.map((k) => [k, previewUrl(id, k)])) : null
}
