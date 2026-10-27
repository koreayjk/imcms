'use server'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { PRIVACY_VERSION, TERMS_VERSION } from '@/lib/service-terms'
import { getPublicT } from '@/lib/cms-t-public'

// 구글로 들어온 회원을 체험 계정으로 바꾼다 (trial-google.sql)
export async function joinTrial(info: { name: string; company: string; position: string; phone: string; agreed_at: string }): Promise<{ ok: true } | { ok: false; error: string }> {
  const { t } = await getPublicT()
  if (!info.company?.trim() || !/^[0-9+\-\s]{9,20}$/.test(info.phone?.trim() ?? '')) return { ok: false, error: t('소속 언론사와 휴대전화 번호를 확인해 주세요.', 'Please check your news organization and mobile phone number.') }
  const supabase = await createServerSupabaseClient()
  const { error } = await supabase.rpc('trial_join', {
    p_name: info.name ?? '', p_company: info.company, p_position: info.position ?? '', p_phone: info.phone,
    p_agreed_at: info.agreed_at || new Date().toISOString(),
  })
  if (error) {
    if (/function .*trial_join|could not find/i.test(error.message)) return { ok: false, error: t('구글 체험 가입이 아직 준비되지 않았습니다. 이메일로 가입해 주세요.', 'Google trial sign-up is not available yet. Please sign up with your email.') }
    return { ok: false, error: error.message }
  }
  // 동의 기록 (legal-billing-safety.sql 전이면 조용히 넘어간다)
  await supabase.rpc('record_consent', { p_terms: TERMS_VERSION, p_privacy: PRIVACY_VERSION, p_source: 'trial' }).then(() => null, () => null)
  return { ok: true }
}
