import type { SupabaseClient } from '@supabase/supabase-js'
import { makeT, type CmsLang } from './cms-i18n'

// 중복 기사 확인 (기사 작성 가이드: 최근 1개월 안에 같은 내용의 기사를 다시 내보내지 않는다 — 네이버 운영평가 J항)
//   같은 보도자료로 만든 기사, 제목이 많이 겹치는 기사를 찾아 "확인할 점" 메모 문장으로 돌려준다

const norm = (t: string) => t.replace(/<[^>]+>/g, '').replace(/[\s'"‘’“”·,.\-…!?()[\]「」『』<>:;~]/g, '').toLowerCase()

function bigrams(t: string) {
  const s = norm(t)
  const out = new Map<string, number>()
  for (let i = 0; i < s.length - 1; i++) out.set(s.slice(i, i + 2), (out.get(s.slice(i, i + 2)) ?? 0) + 1)
  return { map: out, size: Math.max(0, s.length - 1) }
}

// 제목 두 개가 얼마나 겹치는지 (0~1, 글자 두 개씩 묶어 비교)
export function titleSimilarity(a: string, b: string) {
  const x = bigrams(a)
  const y = bigrams(b)
  if (!x.size || !y.size) return 0
  let common = 0
  x.map.forEach((n, k) => { common += Math.min(n, y.map.get(k) ?? 0) })
  return (2 * common) / (x.size + y.size)
}

const STATUS: Record<string, string> = { draft: '작성중', in_review: '승인대기', published: '발행', rejected: '반려' }
const STATUS_EN: Record<string, string> = { draft: 'Draft', in_review: 'Pending approval', published: 'Published', rejected: 'Rejected' }

export async function duplicateNotes(supabase: SupabaseClient, outletId: string | null, title: string, pressId?: string | null, lang: CmsLang = 'ko'): Promise<string[]> {
  const t = makeT(lang)
  const status = (s: string) => (lang === 'en' ? STATUS_EN : STATUS)[s] ?? s
  if (!outletId || !title.trim()) return []
  const since = new Date(Date.now() - 31 * 864e5).toISOString()
  const { data } = await supabase
    .from('articles')
    .select('id, title, status, press_release_id')
    .eq('outlet_id', outletId)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(500)
  const notes: string[] = []
  const seen = new Set<string>()
  for (const a of (data ?? []) as { id: string; title: string; status: string; press_release_id: string | null }[]) {
    if (notes.length >= 3) break
    const same = !!pressId && a.press_release_id === pressId
    if (!same && titleSimilarity(title, a.title) < 0.55) continue
    if (seen.has(a.id)) continue
    seen.add(a.id)
    notes.push(same
      ? t(`같은 보도자료로 만든 기사가 이미 있습니다: 「${a.title}」(${STATUS[a.status] ?? a.status}). 같은 내용을 다시 내보내지 마세요(네이버 운영평가 J항).`, `A story made from the same press release already exists: “${a.title}” (${status(a.status)}). Do not publish the same content again (Naver operations evaluation, item J).`)
      : t(`최근 1개월 안에 비슷한 제목의 기사가 있습니다: 「${a.title}」(${STATUS[a.status] ?? a.status}). 같은 내용이면 내보내지 마세요(네이버 운영평가 J항).`, `A story with a similar headline exists from the past month: “${a.title}” (${status(a.status)}). If it covers the same content, do not publish it (Naver operations evaluation, item J).`))
  }
  return notes
}
