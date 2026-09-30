'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { getCmsContext } from '@/lib/cms'
import type { LogoMode, OutletSiteSettings, SiteLegal } from '@/lib/sites'

export type SitePayload = {
  name: string
  domain: string
  site: OutletSiteSettings
  sections: { id: string; specialty: boolean; description: string }[]
}

const HEX = /^#[0-9a-f]{6}$/i
const LEGAL_KEYS: (keyof SiteLegal)[] = ['company', 'ceo', 'publisher', 'editor', 'youthOfficer', 'registrationNo', 'registeredAt', 'bizNo', 'postcode', 'address', 'phone', 'email']
const cut = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n)

export async function saveSiteSettings(outletId: string, p: SitePayload): Promise<{ error?: string; ok?: string }> {
  const { supabase, isGroupAdmin } = await getCmsContext()
  if (!isGroupAdmin) return { error: '발행인 또는 총관리자만 바꿀 수 있습니다.' }

  const name = cut(p.name, 80)
  if (!name) return { error: '매체 이름을 적어주세요.' }
  const domain = cut(p.domain, 120).replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/^www\./, '').toLowerCase()
  if (domain && !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) && !/^[a-z0-9가-힣.-]+\.[a-z가-힣]{2,}$/.test(domain)) return { error: '도메인 형식을 확인해 주세요. 예: thecaretimes.net' }

  const s = p.site ?? {}
  const logoUrl = cut(s.logoUrl, 500)
  if (logoUrl && !logoUrl.startsWith('/sites/') && !logoUrl.startsWith(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`)) {
    return { error: '로고는 이 화면에서 올린 이미지만 쓸 수 있습니다.' }
  }
  const mode: LogoMode = s.logoMode === 'full' || s.logoMode === 'text' ? s.logoMode : 'mark'
  const email = cut(s.legal?.email, 120)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: '하단 이메일 주소를 확인해 주세요.' }

  const site: OutletSiteSettings = {
    nameEn: cut(s.nameEn, 60),
    slogan: cut(s.slogan, 80),
    sloganEn: cut(s.sloganEn, 80),
    description: cut(s.description, 200),
    logoUrl: logoUrl || undefined,
    logoMode: mode,
    colors: {
      brand: HEX.test(s.colors?.brand ?? '') ? s.colors!.brand : undefined,
      accent: HEX.test(s.colors?.accent ?? '') ? s.colors!.accent : undefined,
    },
    indexable: !!s.indexable,
    pressKeywords: cut(s.pressKeywords, 2000),
    legal: Object.fromEntries(LEGAL_KEYS.map((k) => [k, cut(s.legal?.[k], k === 'address' ? 200 : 80)])) as SiteLegal,
  }

  const { error } = await supabase.from('outlets').update({ name, domain: domain || null, site }).eq('id', outletId)
  if (error) {
    if (/site/.test(error.message)) return { error: '홈페이지 설정을 저장하려면 총관리자가 Supabase에서 outlet-sites.sql을 실행해야 합니다.' }
    if (/duplicate|unique/i.test(error.message)) return { error: '이미 다른 매체가 쓰는 도메인입니다.' }
    return { error: `저장하지 못했습니다: ${error.message}` }
  }
  for (const c of p.sections ?? []) {
    await supabase.from('categories').update({ specialty: !!c.specialty, description: cut(c.description, 100) || null }).eq('id', c.id).eq('outlet_id', outletId)
  }

  revalidateTag('sites')
  revalidatePath('/', 'layout')
  return { ok: '저장했습니다. 홈페이지에 바로 반영됩니다.' }
}
