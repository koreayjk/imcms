import { createServerSupabaseClient } from './supabase-server'

export type GdpaMember = { name: string; phone: string | null; org: string | null; position: string | null; member_type: 'individual' | 'outlet'; status: 'pending' | 'approved' | 'rejected'; marketing: boolean; created_at: string; agreed_terms_at: string; agreed_privacy_at: string }

// 지금 로그인한 사람과 협회 회원 정보 (DB 연결 전에는 로그인 없음)
export async function gdpaSession(): Promise<{ email: string | null; member: GdpaMember | null }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return { email: null, member: null }
  const sb = await createServerSupabaseClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { email: null, member: null }
  const { data } = await sb.from('gdpa_members').select('*').eq('user_id', user.id).maybeSingle()
  return { email: user.email ?? null, member: (data as GdpaMember | null) ?? null }
}
