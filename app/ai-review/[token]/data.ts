import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { ShareData } from '@/lib/ai-share'

export type LoadedShare = { id: string; title: string; data: ShareData; blind: boolean; created_at: string; expires_at: string }

// 링크 토큰으로 공유 불러오기 (로그인 없이, DB 함수로만)
export async function loadShare(token: string): Promise<LoadedShare | null> {
  if (!/^[A-Za-z0-9_-]{24,64}$/.test(token)) return null
  const supabase = await createServerSupabaseClient()
  const { data, error } = await supabase.rpc('ai_compare_share_get', { p_token: token })
  if (error || !data) return null
  return data as LoadedShare
}
