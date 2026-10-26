import { createServerSupabaseClient } from '@/lib/supabase-server'
import { GUIDE_BUCKET, guideFile, HELP_VIDEOS } from '@/lib/help-videos'

export type GuideUploaded = { id: string; size: number; updatedAt: string | null }

// 회원 전용 저장소에 올라온 영상 목록 (저장소를 아직 만들지 않았거나 읽을 수 없으면 빈 목록)
export async function listGuideVideos(): Promise<GuideUploaded[]> {
  try {
    const supabase = await createServerSupabaseClient()
    const { data, error } = await supabase.storage.from(GUIDE_BUCKET).list('', { limit: 200 })
    if (error || !data) return []
    const ids = new Set(HELP_VIDEOS.map((v) => v.id))
    return data.flatMap((f) => {
      const id = f.name.replace(/\.mp4$/, '')
      if (!f.name.endsWith('.mp4') || !ids.has(id)) return []
      const size = Number((f.metadata as { size?: number } | null)?.size ?? 0)
      return [{ id, size, updatedAt: f.updated_at ?? null }]
    })
  } catch {
    return []
  }
}

// 재생용 임시 주소 (6시간). 로그인한 회원에게만 만들어 주고, 주소가 새어도 시간이 지나면 막힌다
export async function guideVideoUrls(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {}
  try {
    const supabase = await createServerSupabaseClient()
    const { data } = await supabase.storage.from(GUIDE_BUCKET).createSignedUrls(ids.map(guideFile), 6 * 3600)
    const out: Record<string, string> = {}
    ;(data ?? []).forEach((d, i) => { if (d.signedUrl) out[ids[i]] = d.signedUrl })
    return out
  } catch {
    return {}
  }
}
