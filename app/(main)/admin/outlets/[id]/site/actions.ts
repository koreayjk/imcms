'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { mentionsAi } from '@/lib/ai-notice'
import { getCmsContext } from '@/lib/cms'
import { foreignTopics, pressFields, type LogoMode, type OutletSiteSettings, type SiteLegal, cleanStats } from '@/lib/sites'
import { parseAiBotMode } from '@/lib/ai-crawlers'
import { parseHomeLayout } from '@/lib/home-layouts'
import { connectDomain } from '@/lib/vercel-domains'
import { isOpenZone } from '@/lib/zoned-time'

export type SitePayload = {
  name: string
  domain: string
  site: OutletSiteSettings
  sections: { id: string; specialty: boolean; description: string }[]
}

const HEX = /^#[0-9a-f]{6}$/i
const LEGAL_KEYS: (keyof SiteLegal)[] = ['company', 'ceo', 'publisher', 'editor', 'youthOfficer', 'registrationNo', 'registeredAt', 'bizNo', 'postcode', 'address', 'phone', 'email']
const cut = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n)
const verifyCode = (v: unknown) => { const t = cut(v, 300); const m = t.match(/content=["']([^"']+)["']/); return (m ? m[1] : t).replace(/[^A-Za-z0-9_\-]/g, '').slice(0, 100) }

export async function saveSiteSettings(outletId: string, p: SitePayload): Promise<{ error?: string; ok?: string }> {
  const { supabase, isStaff } = await getCmsContext()
  if (!isStaff) return { error: '홈페이지 설정은 IM 뉴스룸 운영팀이 합니다. 고객센터 업무요청으로 요청해 주세요.' }

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
    specialtyTitle: cut(s.specialtyTitle, 30) || undefined,
    indexWidget: !!s.indexWidget,
    // 소유 확인 코드: 메타 태그 전체를 붙여 넣어도 content 값만 남긴다
    naverVerification: verifyCode(s.naverVerification) || undefined,
    googleVerification: verifyCode(s.googleVerification) || undefined,
    logoUrl: logoUrl || undefined,
    logoMode: mode,
    // 'normal'은 기본값이므로 저장하지 않는다
    logoSize: s.logoSize === 'large' || s.logoSize === 'xlarge' ? s.logoSize : undefined,
    colors: {
      brand: HEX.test(s.colors?.brand ?? '') ? s.colors!.brand : undefined,
      accent: HEX.test(s.colors?.accent ?? '') ? s.colors!.accent : undefined,
    },
    indexable: !!s.indexable,
    // 오픈 준비 중 스위치 (꺼진 매체는 저장하지 않아 "열린 매체"로 둔다)
    comingSoon: s.comingSoon === true ? true : undefined,
    // 예약 오픈: 그 시각이 되면 오픈 준비 중 화면이 저절로 풀린다 (스위치가 켜져 있을 때만 뜻이 있다)
    openAt: s.openAt && Number.isFinite(Date.parse(s.openAt)) ? new Date(s.openAt).toISOString() : undefined,
    openTz: s.openAt && isOpenZone(s.openTz) ? s.openTz : undefined,
    // 'allow'는 안 막는 기본값이므로 저장하지 않는다
    aiBots: parseAiBotMode(s.aiBots) === 'allow' ? undefined : parseAiBotMode(s.aiBots),
    pressKeywords: cut(s.pressKeywords, 2000),
    legal: Object.fromEntries(LEGAL_KEYS.map((k) => [k, cut(s.legal?.[k], k === 'address' ? 200 : 80)])) as SiteLegal,
    homeLayout: parseHomeLayout(s.homeLayout),
    shopUrl: /^https?:\/\/\S+$/.test(cut(s.shopUrl, 300)) ? cut(s.shopUrl, 300) : undefined,
    pressForeignTopics: foreignTopics({ pressForeignTopics: Array.isArray(s.pressForeignTopics) ? s.pressForeignTopics : [], pressForeign: false }),
    // 고른 적이 없으면 비워 두어 추천 키워드로 계속 짐작한다
    pressFields: Array.isArray(s.pressFields) ? pressFields({ pressFields: s.pressFields }, []) : undefined,
  }
  site.pressForeign = (site.pressForeignTopics ?? []).length > 0
  // 화면에 없는 설정(섹션 띠 순서 등)은 그대로 둔다
  const { data: prev } = await supabase.from('outlets').select('site').eq('id', outletId).maybeSingle()
  const prevSite = ((prev as { site?: OutletSiteSettings | null } | null)?.site ?? {}) as OutletSiteSettings
  if (Array.isArray(prevSite.bands)) site.bands = prevSite.bands
  if (prevSite.ogImage) site.ogImage = prevSite.ogImage
  if (prevSite.trial) site.trial = prevSite.trial
  site.lang = s.lang === 'en' ? 'en' : s.lang === 'ko' ? 'ko' : prevSite.lang
  site.statsBoard = s.statsBoard !== undefined ? cleanStats(s.statsBoard) : prevSite.statsBoard
  if (s.aiNotice?.on && cut(s.aiNotice.text, 150) && !mentionsAi(cut(s.aiNotice.text, 150))) return { error: 'AI 활용 표시 문구에 "AI" 또는 "인공지능"을 넣어 주세요.' }
  site.aiNotice = s.aiNotice !== undefined
    ? { on: !!s.aiNotice?.on, text: cut(s.aiNotice?.text, 150) || undefined }
    : prevSite.aiNotice

  const { error } = await supabase.from('outlets').update({ name, domain: domain || null, site }).eq('id', outletId)
  if (error) {
    if (/site/.test(error.message)) return { error: '홈페이지 설정을 저장하려면 총관리자가 Supabase에서 outlet-sites.sql을 실행해야 합니다.' }
    if (/duplicate|unique/i.test(error.message)) return { error: '이미 다른 매체가 쓰는 도메인입니다.' }
    return { error: `저장하지 못했습니다: ${error.message}` }
  }
  for (const c of p.sections ?? []) {
    await supabase.from('categories').update({ specialty: !!c.specialty, description: cut(c.description, 100) || null }).eq('id', c.id).eq('outlet_id', outletId)
  }

  revalidateTag('sites', { expire: 0 })
  revalidatePath('/', 'layout')
  // 도메인을 Vercel에도 등록 (VERCEL_API_TOKEN 이 있을 때)
  const dErr = await connectDomain(domain || null)
  if (dErr) return { error: `저장했지만 도메인을 Vercel에 연결하지 못했습니다: ${dErr}` }
  return { ok: '저장했습니다. 홈페이지에 바로 반영됩니다.' }
}

// 도메인 다시 연결 (홈페이지 설정 화면의 '도메인 연결' 칸)
export async function reconnectDomain(outletId: string): Promise<{ error?: string; ok?: string }> {
  const { supabase, isStaff } = await getCmsContext()
  if (!isStaff) return { error: '운영팀만 할 수 있습니다.' }
  const { data } = await supabase.from('outlets').select('domain').eq('id', outletId).maybeSingle()
  if (!data?.domain) return { error: '먼저 도메인을 저장해 주세요.' }
  const err = await connectDomain(data.domain)
  revalidatePath(`/admin/outlets/${outletId}/site`)
  return err ? { error: err } : { ok: 'Vercel에 등록했습니다. 아래 DNS 설정을 확인해 주세요.' }
}

// 검색 등록 점검 (운영팀): 매체 주소에서 확인 코드·robots.txt·사이트맵이 실제로 보이는지 확인한다
//   저장된 매체 도메인만 열어 본다 (다른 주소는 열지 않는다)
export type SearchCheck = { label: string; ok: boolean; detail: string }
export async function checkSearchSetup(outletId: string): Promise<{ items?: SearchCheck[]; error?: string }> {
  const { supabase, isStaff } = await getCmsContext()
  if (!isStaff) return { error: '운영팀만 확인할 수 있습니다.' }
  const { data: o } = await supabase.from('outlets').select('domain, site').eq('id', outletId).maybeSingle()
  const domain = String((o as { domain?: string | null } | null)?.domain ?? '').toLowerCase()
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) return { error: '먼저 위 “도메인” 칸에 매체 주소를 저장해 주세요.' }
  const site = ((o as { site?: OutletSiteSettings | null } | null)?.site ?? {}) as OutletSiteSettings
  const base = `https://${domain}`
  const get = async (path: string) => {
    try {
      const r = await fetch(base + path, { redirect: 'follow', cache: 'no-store', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'IMNewsroom-SearchCheck/1.0' } })
      return { status: r.status, text: (await r.text()).slice(0, 400_000) }
    } catch (e) {
      return { status: 0, text: e instanceof Error ? e.message : '' }
    }
  }
  const [home, robots, sitemap] = await Promise.all([get('/'), get('/robots.txt'), get('/sitemap.xml')])
  const items: SearchCheck[] = []
  items.push({ label: '홈페이지가 열림', ok: home.status === 200, detail: home.status ? `응답 ${home.status}` : `열리지 않음 (${home.text.slice(0, 80)})` })
  const meta = (name: string) => home.text.match(new RegExp(`<meta[^>]+name="${name}"[^>]+content="([^"]+)"`))?.[1] ?? null
  const nv = meta('naver-site-verification')
  const gv = meta('google-site-verification')
  items.push({ label: '네이버 확인 코드', ok: !!nv && (!site.naverVerification || nv === site.naverVerification), detail: nv ? (site.naverVerification && nv !== site.naverVerification ? '저장한 코드와 다릅니다. 저장했는지 확인하세요' : '홈페이지에 들어 있음') : site.naverVerification ? '저장은 됐지만 홈페이지에 아직 안 보입니다. 1분 뒤 다시 확인하세요' : '아직 넣지 않음' })
  items.push({ label: '구글 확인 코드', ok: !!gv && (!site.googleVerification || gv === site.googleVerification), detail: gv ? (site.googleVerification && gv !== site.googleVerification ? '저장한 코드와 다릅니다. 저장했는지 확인하세요' : '홈페이지에 들어 있음') : site.googleVerification ? '저장은 됐지만 홈페이지에 아직 안 보입니다. 1분 뒤 다시 확인하세요' : '아직 넣지 않음' })
  const allowed = robots.status === 200 && /^Allow: \/\s*$/m.test(robots.text) && !/^Disallow: \/\s*$/m.test(robots.text)
  items.push({ label: '검색 허용 (robots.txt)', ok: allowed, detail: allowed ? '검색엔진이 읽을 수 있음' : '막혀 있습니다. 위 “구글·네이버 검색에 노출하기”를 켜고 저장했는지, 매체 도메인으로 열었는지 확인하세요' })
  const n = (sitemap.text.match(/<url>/g) ?? []).length
  items.push({ label: '사이트맵', ok: sitemap.status === 200 && n > 0, detail: sitemap.status === 200 ? `주소 ${n}개` : `응답 ${sitemap.status || '없음'}` })
  return { items }
}
