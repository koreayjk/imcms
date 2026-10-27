'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { mentionsAi } from '@/lib/ai-notice'
import { getCmsContext } from '@/lib/cms'
import { getT } from '@/lib/cms-t'
import { cleanLogoStrip, foreignTopics, type LogoMode, type OutletSiteSettings, type SiteLegal } from '@/lib/sites'

// 편집장 이상이 편집국 "설정 → 매체 정보"에서 고치는 항목만 저장한다 (supabase/outlet-site-self.sql 의 DB 함수가 한 번 더 목록 밖의 값을 막는다)
//   도메인·검색 노출·AI 봇·오픈 준비 중·홈 배치 같은 항목은 여기서 받지 않는다 (운영팀 홈페이지 설정에서만)
export type SelfSitePayload = {
  name: string
  site: Pick<OutletSiteSettings, 'nameEn' | 'slogan' | 'sloganEn' | 'description' | 'logoUrl' | 'logoMode' | 'logoSize' | 'colors' | 'legal' | 'aiNotice' | 'pressForeignTopics' | 'pressForeign' | 'logoStrip' | 'iconUrl' | 'ogImage' | 'cmsLang' | 'commentsOn' | 'commentsMode' | 'commentsKind'>
  sections: { id: string; specialty: boolean; description: string }[]
}

const HEX = /^#[0-9a-f]{6}$/i
const LEGAL_KEYS: (keyof SiteLegal)[] = ['company', 'ceo', 'publisher', 'editor', 'youthOfficer', 'registrationNo', 'registeredAt', 'bizNo', 'postcode', 'address', 'phone', 'email']
const cut = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n)

export async function saveSelfSiteSettings(outletId: string, p: SelfSitePayload): Promise<{ error?: string; ok?: string }> {
  const { supabase, isEditorPlus, isStaff } = await getCmsContext()
  const { t } = await getT()
  if (!isEditorPlus && !isStaff) return { error: t('편집장 이상만 고칠 수 있습니다.', 'Only Editors-in-Chief and above can edit this.') }
  const name = cut(p.name, 80)
  if (!name) return { error: t('매체 이름을 적어주세요.', 'Enter an outlet name.') }
  const s = p.site ?? {}
  const logoUrl = cut(s.logoUrl, 500)
  if (logoUrl && !logoUrl.startsWith('/sites/') && !logoUrl.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`)) {
    return { error: t('로고는 이 화면에서 올린 이미지만 쓸 수 있습니다.', 'Only images uploaded on this screen can be used as the logo.') }
  }
  // 탭 아이콘·공유 미리보기 사진도 이 화면에서 올린 이미지만
  const ownImage = (v: unknown) => {
    const u = cut(v, 500)
    return !u || u.startsWith('/sites/') || u.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`) ? u : null
  }
  const iconUrl = ownImage(s.iconUrl)
  const ogImage = ownImage(s.ogImage)
  if (iconUrl === null || ogImage === null) return { error: t('이미지는 이 화면에서 올린 것만 쓸 수 있습니다.', 'Only images uploaded on this screen can be used.') }
  const email = cut(s.legal?.email, 120)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: t('하단 이메일 주소를 확인해 주세요.', 'Check the footer email address.') }
  if (s.aiNotice?.on && cut(s.aiNotice.text, 150) && !mentionsAi(cut(s.aiNotice.text, 150))) return { error: t('AI 활용 표시 문구에 "AI" 또는 "인공지능"을 넣어 주세요.', 'The AI disclosure text must include "AI" or "artificial intelligence".') }
  const topics = foreignTopics({ pressForeignTopics: Array.isArray(s.pressForeignTopics) ? s.pressForeignTopics : [], pressForeign: false })
  const mode: LogoMode = s.logoMode === 'full' || s.logoMode === 'text' ? s.logoMode : 'mark'

  // 비어 있는 값은 보내지 않는다 (DB 함수가 지워 기본값으로 돌아간다)
  const patch: Record<string, unknown> = {
    nameEn: cut(s.nameEn, 60) || undefined,
    slogan: cut(s.slogan, 80) || undefined,
    sloganEn: cut(s.sloganEn, 80) || undefined,
    description: cut(s.description, 200) || undefined,
    logoUrl: logoUrl || undefined,
    iconUrl: iconUrl || undefined,
    ogImage: ogImage || undefined,
    logoMode: mode,
    logoSize: s.logoSize === 'large' || s.logoSize === 'xlarge' ? s.logoSize : undefined,
    colors: { brand: HEX.test(s.colors?.brand ?? '') ? s.colors!.brand : undefined, accent: HEX.test(s.colors?.accent ?? '') ? s.colors!.accent : undefined },
    legal: Object.fromEntries(LEGAL_KEYS.map((k) => [k, cut(s.legal?.[k], k === 'address' ? 200 : 80)])),
    aiNotice: { on: !!s.aiNotice?.on, ...(cut(s.aiNotice?.text, 150) ? { text: cut(s.aiNotice?.text, 150) } : {}) },
    pressForeignTopics: topics,
    pressForeign: topics.length > 0,
    logoStrip: cleanLogoStrip(s.logoStrip),
    commentsOn: s.commentsOn === true ? true : undefined,
    commentsKind: s.commentsOn === true && s.commentsKind === 'guest' ? 'guest' : undefined,
    commentsMode: s.commentsOn === true && s.commentsMode === 'open' ? 'open' : undefined,
    cmsLang: s.cmsLang === 'en' ? 'en' : s.cmsLang === 'ko' ? 'ko' : undefined,
  }
  const { error } = await supabase.rpc('outlet_site_self_save', { o: outletId, p_name: name, p_patch: JSON.parse(JSON.stringify(patch)) })
  if (error) {
    if (/outlet_site_self_save|function/i.test(error.message) && /does not exist|schema cache|find/i.test(error.message)) return { error: t('이 기능을 쓰려면 운영팀이 Supabase에서 outlet-site-self.sql을 실행해야 합니다.', 'To use this feature, the IM Newsroom team needs to run outlet-site-self.sql in Supabase.') }
    return { error: error.message.replace(/^.*?:\s*/, '') }
  }
  for (const c of p.sections ?? []) {
    await supabase.from('categories').update({ specialty: !!c.specialty, description: cut(c.description, 100) || null }).eq('id', c.id).eq('outlet_id', outletId)
  }
  revalidateTag('sites', { expire: 0 })
  revalidatePath('/', 'layout')
  revalidatePath('/admin/settings')
  return { ok: t('저장했습니다. 홈페이지에 바로 반영됩니다.', 'Saved. Changes appear on your website right away.') }
}
