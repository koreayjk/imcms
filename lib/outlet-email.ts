import type { SupabaseClient } from '@supabase/supabase-js'

// 언론사 대표 이메일 (newsroom-settings.sql 실행 전이면 ready=false)
export async function outletEmailOf(supabase: SupabaseClient, outletId: string | null) {
  if (!outletId) return { ready: false, email: null as string | null }
  const { data, error } = await supabase.from('outlets').select('contact_email').eq('id', outletId).maybeSingle()
  if (error) return { ready: false, email: null }
  return { ready: true, email: (data?.contact_email as string | null) ?? null }
}
