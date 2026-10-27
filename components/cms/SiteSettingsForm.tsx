'use client'

import { useMemo, useRef, useState, useTransition, type CSSProperties, type ReactNode } from 'react'
import { AI_NOTICE_DEFAULT } from '@/lib/ai-notice'
import { AI_BOT_MODES } from '@/lib/ai-crawlers'
import { HOME_LAYOUTS } from '@/lib/home-layouts'
import { previewUrl } from '@/lib/product'
import HomeLayoutThumb from './HomeLayoutThumb'
import { useRouter } from 'next/navigation'
import { saveSiteSettings } from '@/app/(main)/admin/outlets/[id]/site/actions'
import { saveSelfSiteSettings } from '@/app/(main)/admin/settings/site-actions'
import { OPEN_ZONES, formatZoned, isoToZoned, zonedToIso } from '@/lib/zoned-time'
import SearchRegisterGuide from './SearchRegisterGuide'
import GovPicker from './GovPicker'
import GovLogoFinder from './GovLogoFinder'
import LogoStrip from '@/components/site/LogoStrip'
import { buildSite, cleanLogoStrip, DEFAULT_COLORS, foreignTopics, openTimePassed, pressFields, type CategoryRow, type LogoMode, type LogoSize, type OutletSiteSettings, type SiteLegal } from '@/lib/sites'
import { FOREIGN_TOPICS, PRESS_FIELDS } from '@/lib/press-sources'
import { uploadImage } from '@/components/editor/upload'
import SiteHeader from '@/components/site/SiteHeader'
import SiteFooter from '@/components/site/SiteFooter'
import { useCmsLang, useT } from './CmsLang'
import DateTimeField from './DateTimeField'

type Section = CategoryRow & { id: string }
type Props = {
  outlet: { id: string; name: string; domain: string | null; site: OutletSiteSettings | null }
  sections: Section[]
  defaults: OutletSiteSettings
  // 편집장 이상이 편집국 설정에서 쓰는 화면: 운영팀 전용 항목(도메인·검색 노출·오픈 준비 중·홈 배치 등)을 숨기고 허용된 항목만 저장한다
  self?: boolean
}

const PRESETS = [
  { brand: '#02472F', accent: '#D3A82B', label: '녹색·금색' },
  { brand: '#1F3A5F', accent: '#C9A227', label: '남색·금색' },
  { brand: '#8C1D2B', accent: '#1F2937', label: '버건디' },
  { brand: '#0B5CAD', accent: '#F59E0B', label: '파랑·주황' },
  { brand: '#1C1F26', accent: '#E5483A', label: '검정·빨강' },
  { brand: '#5B2A86', accent: '#E0A526', label: '보라·금색' },
]

const PRESET_LABEL_EN: Record<string, string> = { '녹색·금색': 'Green & gold', '남색·금색': 'Navy & gold', '버건디': 'Burgundy', '파랑·주황': 'Blue & orange', '검정·빨강': 'Black & red', '보라·금색': 'Purple & gold' }

// 영어판 (한국 법정 표기는 영어로 의미를 풀어 쓴다)
const LEGAL_EN: Record<keyof SiteLegal, { label: string; ph?: string }> = {
  company: { label: 'Publishing company (legal name)' },
  registrationNo: { label: 'Online newspaper registration no.', ph: 'e.g. Gyeonggi, A-53782 (as on your registration certificate)' },
  registeredAt: { label: 'Registration date', ph: 'e.g. 2023.09.04' },
  publisher: { label: 'Publisher' },
  editor: { label: 'Editor (legally responsible editor)' },
  youthOfficer: { label: 'Youth protection officer' },
  ceo: { label: 'CEO / Representative' },
  bizNo: { label: 'Business registration no.' },
  phone: { label: 'Phone' },
  email: { label: 'Email (news tips & advertising inquiries)' },
  postcode: { label: 'Postal code' },
  address: { label: 'Address' },
}

// 홈 배치·해외 언론 묶음·보도자료 분야·AI 크롤러 설명의 영어판 (원본은 lib 의 한국어 상수)
const LAYOUT_EN: Record<string, { name: string; label: string; features: string }> = {
  standard: { name: 'Korean style 1', label: 'Standard 3-column', features: 'Sub stories on the left, a big headline in the center, real-time news on the right, followed by Top News, Most Read and Specialty News. The most standard look for Korean online newspapers.' },
  portal: { name: 'Korean style 2', label: 'Portal list', features: 'One large top story plus a headline list on the right, with a breaking-news strip at the very top. Shows many headlines, so it suits outlets with lots of stories.' },
  bands: { name: 'Korean style 3', label: 'Section bands', features: 'Stacks horizontal bands per section under the top story (breaking-news, big-story and 4-photo types). Suits trade publications with a clear subject focus.' },
  editorial: { name: 'US style 1', label: 'Editorial', features: 'A classic newspaper with a large centered masthead, thin dividers and serif headlines. Suits current-affairs, analysis and association outlets.' },
  cards: { name: 'US style 2', label: 'Card magazine', features: 'A large hero photo plus a rounded card grid with generous white space. Suits local news, English-language outlets and outlets with many mobile readers.' },
}
const FOREIGN_EN: Record<string, { label: string; hint: string }> = {
  israel: { label: 'Israeli media', hint: 'Jerusalem Post, JNS, Ynet, etc.' },
  education: { label: 'International education & study-abroad media', hint: 'Inside Higher Ed, The PIE News, ICEF Monitor, etc.' },
  mission: { label: 'International missions media', hint: 'IMB, OMF, Wycliffe, ICC (persecuted church), Christianity Today' },
  reformed: { label: 'International Reformed & Christian education media', hint: 'The Gospel Coalition, Reformation21, 9Marks, Association of Classical Christian Schools (ACCS), etc.' },
}
const PRESS_FIELD_EN: Record<string, string> = { medical: 'Medical & welfare', shipping: 'Shipping, logistics & trade', education: 'Education' }
const AI_BOT_EN: Record<string, { label: string; hint: string }> = {
  allow: { label: 'Allow all', hint: 'Block nothing, as now. AI may use your stories for training and may show them as sources in answers.' },
  answer: { label: 'Block training crawls, but allow AI search and answers to cite you as a source (recommended)', hint: 'Lets ChatGPT, Claude and Perplexity link to your stories when answering questions, and blocks only the bulk crawlers used for model training.' },
  block: { label: 'Block all AI bots', hint: 'Blocks both kinds above. Your stories may not appear as sources in AI answers.' },
}

// 신문법·청소년보호법상 인터넷신문이 홈페이지에 표시해야 하는 항목은 *
const LEGAL: { k: keyof SiteLegal; label: string; required?: boolean; ph?: string; wide?: boolean }[] = [
  { k: 'company', label: '발행소(회사명)', required: true },
  { k: 'registrationNo', label: '등록번호', required: true, ph: '예: 경기, 아53782' },
  { k: 'registeredAt', label: '등록일', required: true, ph: '예: 2023.09.04' },
  { k: 'publisher', label: '발행인', required: true },
  { k: 'editor', label: '편집인', required: true },
  { k: 'youthOfficer', label: '청소년보호책임자', required: true },
  { k: 'ceo', label: '대표' },
  { k: 'bizNo', label: '사업자등록번호' },
  { k: 'phone', label: '전화', required: true },
  { k: 'email', label: '이메일(기사제보·광고문의)' },
  { k: 'postcode', label: '우편번호' },
  { k: 'address', label: '주소', required: true, wide: true },
]

function Card({ title, note, children }: { title: string; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-white p-4 sm:p-6">
      <h2 className="text-[15.5px] font-bold">{title}</h2>
      {note && <p className="mt-1 text-[12.5px] leading-relaxed text-muted">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11.5px] text-muted">{hint}</span>}
    </label>
  )
}

// 로고 이미지의 빈 여백(투명하거나 거의 흰 가장자리)을 잘라 낸다: 여백이 많으면 머리글에서 작아 보인다
async function trimLogo(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file)
    const w = bmp.width, h = bmp.height
    if (w * h > 16_000_000) return file
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h
    const ctx = cv.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(bmp, 0, 0)
    const d = ctx.getImageData(0, 0, w, h).data
    let x0 = w, y0 = h, x1 = -1, y1 = -1
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const blank = d[i + 3] < 24 || (d[i] > 244 && d[i + 1] > 244 && d[i + 2] > 244)
      if (!blank) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
    }
    if (x1 < 0) return file
    const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.02)
    x0 = Math.max(0, x0 - pad); y0 = Math.max(0, y0 - pad); x1 = Math.min(w - 1, x1 + pad); y1 = Math.min(h - 1, y1 + pad)
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1
    if (cw * ch > w * h * 0.92) return file
    const out = document.createElement('canvas'); out.width = cw; out.height = ch
    out.getContext('2d')!.drawImage(cv, x0, y0, cw, ch, 0, 0, cw, ch)
    const blob = await new Promise<Blob | null>((res) => out.toBlob(res, 'image/png'))
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.png', { type: 'image/png' }) : file
  } catch {
    return file
  }
}

export default function SiteSettingsForm({ outlet, sections: initialSections, defaults, self = false }: Props) {
  const t = useT()
  const lang = useCmsLang()
  const legalLabel = (f: (typeof LEGAL)[number]) => (lang === 'en' ? LEGAL_EN[f.k].label : f.label)
  const router = useRouter()
  const init = { ...defaults, ...(outlet.site ?? {}) }
  const [name, setName] = useState(outlet.name)
  const [domain, setDomain] = useState(outlet.domain ?? '')
  const [s, setS] = useState<OutletSiteSettings>({
    ...init,
    colors: { brand: init.colors?.brand ?? DEFAULT_COLORS.brand, accent: init.colors?.accent ?? DEFAULT_COLORS.accent },
    legal: { ...(defaults.legal ?? {}), ...(outlet.site?.legal ?? {}) },
    // 예약 시각이 이미 지났으면 홈페이지는 열려 있다 (저장된 스위치는 남아 있으므로 화면에서는 꺼진 것으로 보여 주고, 저장하면 실제로 꺼진다)
    comingSoon: init.comingSoon && !openTimePassed(init) ? true : undefined,
  })
  const [sections, setSections] = useState(initialSections)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({})
  const [pending, start] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (patch: Partial<OutletSiteSettings>) => setS((prev) => ({ ...prev, ...patch }))
  const keywordList = (s.pressKeywords ?? '').split(/[,\n]/).map((k) => k.trim()).filter(Boolean)
  const setLegal = (k: keyof SiteLegal, v: string) => setS((prev) => ({ ...prev, legal: { ...prev.legal, [k]: v } }))

  // 저장 전에 바로 보이는 미리보기
  const preview = useMemo(
    () => buildSite({ id: outlet.id, name: name || t('매체 이름', 'Outlet name'), domain: domain || null, site: s }, sections),
    [outlet.id, name, domain, s, sections, t]
  )
  const vars = { '--brand': preview.colors.brand, '--brand-dark': preview.colors.brandDark, '--gold': preview.colors.gold, '--gold-ink': preview.colors.goldInk } as CSSProperties
  // 로고 띠 편집
  const stripItems = s.logoStrip?.items ?? []
  const putStrip = (items: typeof stripItems) => set({ logoStrip: { ...(s.logoStrip ?? {}), items } })
  const setStripItem = (i: number, patch: Partial<(typeof stripItems)[number]>) => putStrip(stripItems.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  const moveStripItem = (i: number, d: number) => { const a = [...stripItems]; const [x] = a.splice(i, 1); a.splice(i + d, 0, x); putStrip(a) }
  async function pickStripLogo(i: number, files: FileList | null) {
    const f = files?.[0]; if (!f) return
    setUploading(true)
    try { setStripItem(i, { img: await uploadImage(f, outlet.id) }) } catch (e) { window.alert(e instanceof Error ? e.message : t('로고를 올리지 못했습니다.', 'Could not upload the logo.')) } finally { setUploading(false) }
  }
  async function addStripLogos(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    try {
      const added: typeof stripItems = []
      for (const f of Array.from(files).slice(0, 40 - stripItems.length)) added.push({ name: f.name.replace(/\.[^.]+$/, '').slice(0, 40), img: await uploadImage(f, outlet.id) })
      putStrip([...stripItems, ...added])
    } catch (e) { window.alert(e instanceof Error ? e.message : t('로고를 올리지 못했습니다.', 'Could not upload the logo.')) } finally { setUploading(false) }
  }
  const openLocal = isoToZoned(s.openAt, s.openTz ?? 'Asia/Seoul')
  const missing = LEGAL.filter((f) => f.required && !s.legal?.[f.k]?.trim())

  async function pickLogo(files: FileList | null) {
    const f = files?.[0]
    if (!f) return
    setUploading(true)
    try {
      const url = await uploadImage(await trimLogo(f), outlet.id)
      set({ logoUrl: url, logoMode: s.logoMode === 'text' ? 'mark' : s.logoMode })
    } catch (e) {
      window.alert(e instanceof Error ? e.message : t('로고를 올리지 못했습니다.', 'Could not upload the logo.'))
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const save = () => start(async () => {
    if (self) {
      const r = await saveSelfSiteSettings(outlet.id, {
        name,
        site: { nameEn: s.nameEn, slogan: s.slogan, sloganEn: s.sloganEn, description: s.description, logoUrl: s.logoUrl, logoMode: s.logoMode, logoSize: s.logoSize, colors: s.colors, legal: s.legal, aiNotice: s.aiNotice, pressForeignTopics: s.pressForeignTopics, pressForeign: s.pressForeign, logoStrip: s.logoStrip, iconUrl: s.iconUrl, ogImage: s.ogImage, cmsLang: s.cmsLang, commentsOn: s.commentsOn },
        sections: sections.map((c) => ({ id: c.id, specialty: !!c.specialty, description: c.description ?? '' })),
      })
      setMsg(r)
      if (!r.error) router.refresh()
      return
    }
    const r = await saveSiteSettings(outlet.id, {
      name, domain, site: s,
      sections: sections.map((c) => ({ id: c.id, specialty: !!c.specialty, description: c.description ?? '' })),
    })
    setMsg(r)
    if (!r.error) router.refresh()
  })

  return (
    <div className="space-y-5 pb-24">
      {/* 미리보기 */}
      <section className="overflow-hidden rounded-lg border border-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line bg-[#F8F9FA] px-4 py-2 text-[12.5px]">
          <span className="font-semibold">{t('미리보기', 'Preview')} <span className="font-normal text-muted">{t('(PC 화면 머리 부분, 저장 전에도 바로 바뀝니다)', '(top of the desktop page; updates instantly, even before saving)')}</span></span>
          <a href={previewUrl(outlet.id)} target="_blank" rel="noopener" className="font-semibold text-review underline underline-offset-2">{t('저장한 홈페이지 전체 보기 ↗', 'View the saved website ↗')}</a>
        </div>
        <div className="pointer-events-none h-[118px] overflow-hidden" aria-hidden>
          <div className="site origin-top-left scale-[0.62]" style={{ ...vars, width: '161%' }}>
            <SiteHeader site={preview} />
          </div>
        </div>
      </section>

      <Card title={t('기본 정보', 'Basic information')}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('매체 이름 (제호)', 'Outlet name (masthead title)')}><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="field-input" /></Field>
          <Field label={t('영문 이름', 'English name')} hint={t('로고 아래 작은 글자 (비워도 됨)', 'Small text under the logo (optional)')}><input value={s.nameEn ?? ''} onChange={(e) => set({ nameEn: e.target.value })} maxLength={60} placeholder={t('예: THE CARE TIMES', 'e.g. THE CARE TIMES')} className="field-input" /></Field>
          <Field label={t('편집국 언어 / Newsroom language', 'Newsroom language')} hint={t('이 매체 구성원이 보는 편집국 화면 언어 (개인은 내 정보에서 따로 고를 수 있음)', 'The language of the newsroom screens for this outlet\'s members (each person can choose their own under My account)')}>
            <select value={s.cmsLang ?? 'ko'} onChange={(e) => set({ cmsLang: e.target.value === 'en' ? 'en' : 'ko' })} className="field-input">
              <option value="ko">한국어</option>
              <option value="en">English</option>
            </select>
          </Field>
          <label className="flex items-start gap-2 text-[13.5px] sm:col-span-2">
            <input type="checkbox" checked={!!s.commentsOn} onChange={(e) => set({ commentsOn: e.target.checked })} className="mt-1" />
            <span><strong>{t('기사 댓글 받기', 'Accept comments on stories')}</strong> <span className="block text-[12px] text-muted">{t('독자가 구글 또는 이메일로 로그인해 기사 아래에 댓글을 씁니다. 모든 댓글은 편집국이 승인해야 보입니다 (편집국 → 댓글). 이 기능을 쓰려면 운영팀이 Supabase에서 comments.sql을 먼저 실행해야 합니다.', 'Readers sign in with Google or email and comment under stories. Every comment must be approved in the newsroom (Comments) before it shows. The operations team must run comments.sql in Supabase first.')}</span></span>
          </label>
          <Field label={t('슬로건', 'Slogan')} hint={t('메뉴·하단에 표시', 'Shown in the menu and footer')}><input value={s.slogan ?? ''} onChange={(e) => set({ slogan: e.target.value })} maxLength={80} className="field-input" /></Field>
          <Field label={t('영문 슬로건', 'English slogan')}><input value={s.sloganEn ?? ''} onChange={(e) => set({ sloganEn: e.target.value })} maxLength={80} className="field-input" /></Field>
          <div className="space-y-4 sm:col-span-2">
            <Field label={t('매체 소개', 'Outlet description')} hint={t('검색 결과·공유할 때 나오는 설명 (160자 이내 권장)', 'Shown in search results and when shared (160 characters or fewer recommended)')}><input value={s.description ?? ''} onChange={(e) => set({ description: e.target.value })} maxLength={200} className="field-input" /></Field>
            {!self && (
              <>
            <Field label={t('전문뉴스 제목', 'Specialty news title')} hint={t('첫 화면 전문 섹션 묶음의 제목 (예: 국제물류 전문뉴스)', 'Title of the specialty-section group on the home page (e.g. International Logistics News)')}><input value={s.specialtyTitle ?? ''} onChange={(e) => set({ specialtyTitle: e.target.value })} maxLength={30} placeholder={t('전문뉴스', 'Specialty news')} className="field-input" /></Field>
            <label className="flex items-start gap-2 text-[13.5px]">
              <input type="checkbox" checked={!!s.indexWidget} onChange={(e) => set({ indexWidget: e.target.checked })} className="mt-1" />
              <span><strong>{t('해운 운임지수 위젯', 'Shipping freight index widget')}</strong> {t('(SCFI·KCCI 주간 그래프를 홈 오른쪽에 표시)', '(shows weekly SCFI and KCCI charts on the right of the home page)')} <span className="block text-[12px] text-muted">{t('켜면 편집국 “홈편집”에서 매주 지수 값을 입력할 수 있습니다.', 'When on, you can enter the index values each week under “Home editing” in the newsroom.')}</span></span>
            </label>
            <StatsEditor value={s.statsBoard} onChange={(statsBoard) => set({ statsBoard })} />
            <fieldset className="space-y-2 text-[13.5px]">
              <legend className="font-bold">{t('홈페이지 배치', 'Home page layout')}</legend>
              <p className="text-[12px] text-muted">{lang === 'en' ? <>Choose how the home page looks. Stories, logo and colors stay the same; only the layout changes. <strong>Preview</strong> shows it in a new window with this outlet&apos;s real stories without saving, and you can send that address to the customer to choose together. Saving applies it to the website right away.</> : <>첫 화면의 모양을 고릅니다. 기사·로고·색은 그대로이고 배치만 바뀝니다. <strong>미리보기</strong>는 저장하지 않아도 이 매체의 실제 기사로 새 창에 보여 주며, 그 주소를 고객에게 보내 함께 고를 수도 있습니다. 저장하면 홈페이지에 바로 적용됩니다.</>}</p>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {HOME_LAYOUTS.map((l) => {
                  const on = (s.homeLayout ?? 'standard') === l.key
                  return (
                    <label key={l.key} className={`flex flex-col gap-2 rounded-lg border p-3 ${l.ready ? 'cursor-pointer' : 'cursor-not-allowed opacity-55'} ${on ? 'border-ink ring-1 ring-ink' : 'border-line'}`}>
                      <HomeLayoutThumb layout={l.key} />
                      <span className="flex items-center gap-2">
                        <input type="radio" name="homeLayout" checked={on} disabled={!l.ready} onChange={() => set({ homeLayout: l.key })} />
                        <strong>{lang === 'en' ? LAYOUT_EN[l.key]?.name ?? l.name : l.name}</strong><span className="text-muted">· {lang === 'en' ? LAYOUT_EN[l.key]?.label ?? l.label : l.label}</span>
                        {!l.ready && <span className="ml-auto rounded bg-line px-1.5 py-0.5 text-[11px] text-muted">{t('준비 중', 'Coming soon')}</span>}
                        {l.ready && (
                          <a href={previewUrl(outlet.id, l.key)} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} className="ml-auto whitespace-nowrap rounded border border-line px-2 py-0.5 text-[12px] font-semibold text-ink hover:border-ink">{t('미리보기 ↗', 'Preview ↗')}</a>
                        )}
                      </span>
                      <span className="text-[12px] leading-snug text-muted">{lang === 'en' ? LAYOUT_EN[l.key]?.features ?? l.features : l.features}</span>
                    </label>
                  )
                })}
              </div>
              {s.homeLayout === 'bands' && <p className="text-[12px] text-muted">{t('섹션 띠는 섹션 순서대로 자동으로 만들어집니다', 'Section bands are built automatically in section order')}{s.bands?.length ? t(` (지금 ${s.bands.length}개 띠 설정됨)`, ` (${s.bands.length} ${s.bands.length === 1 ? 'band' : 'bands'} currently set)`) : ''}{t('. 띠 순서·모양을 따로 정하려면 운영팀에 요청하세요.', '. To set the band order and style separately, ask the IM Newsroom team.')}</p>}
            </fieldset>
            <label className="flex items-start gap-2 text-[13.5px]">
              <input type="checkbox" checked={s.lang === 'en'} onChange={(e) => set({ lang: e.target.checked ? 'en' : 'ko' })} className="mt-1" />
              <span><strong>{t('영문 홈페이지', 'English website')}</strong> {t('(메뉴·날짜·안내 문구·개인정보처리방침을 영어로)', '(menus, dates, notices and the privacy policy in English)')} <span className="block text-[12px] text-muted">{t('기사는 쓴 언어 그대로 나갑니다. 해외 독자를 위한 영문 매체에 켜세요.', 'Stories are published in the language they were written in. Turn this on for English-language outlets for overseas readers.')}</span></span>
            </label>
            {s.lang === 'en' && (
              <label className="flex flex-wrap items-center gap-2 pl-6 text-[13px]">
                {t('날짜·시각 시간대', 'Date and time zone')}
                <select value={s.timeZone ?? 'America/New_York'} onChange={(e) => set({ timeZone: e.target.value })} className="field-input w-56 py-1">
                  {OPEN_ZONES.filter((z) => z.tz.startsWith('America/') || z.tz === 'Pacific/Honolulu' || z.tz === 'Europe/London' || z.tz === 'UTC').map((z) => <option key={z.tz} value={z.tz}>{lang === 'en' ? z.en : z.label}</option>)}
                </select>
                <span className="text-[12px] text-muted">{t('기사 날짜 옆 ET·CT 같은 표시가 이 시간대로 나옵니다.', 'Time zone labels such as ET or CT next to story dates follow this time zone.')}</span>
              </label>
            )}
              </>
            )}
            <div className="space-y-1.5 rounded-lg border border-line p-3 text-[13.5px]">
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={!!s.aiNotice?.on} onChange={(e) => set({ aiNotice: { ...s.aiNotice, on: e.target.checked } })} className="mt-1" />
                <span><strong>{t('AI 활용 표시', 'AI disclosure')}</strong> {t('(AI 초안으로 만든 기사 본문 끝에 아래 문구를 자동으로 넣기)', '(automatically adds the text below to the end of stories created from an AI draft)')} <span className="block text-[12px] text-muted">{t('네이버 뉴스제휴 운영평가는 AI로 만든 글·사진을 표시하지 않으면 벌점(0.5점)입니다. 넣은 문구는 기사 편집 화면에서 지울 수 있습니다. ', 'Under the Naver News partnership evaluation, failing to label text or photos made with AI costs a 0.5-point penalty. The added text can be removed on the story edit screen. ')}<a href="/support/guide#ai" target="_blank" className="underline">{t('기사 작성 가이드', 'Story writing guide')}</a></span></span>
              </label>
              {s.aiNotice?.on && (
                <input
                  value={s.aiNotice?.text ?? ''} maxLength={150} className="field-input"
                  placeholder={AI_NOTICE_DEFAULT[s.lang === 'en' ? 'en' : 'ko']}
                  onChange={(e) => set({ aiNotice: { on: true, text: e.target.value } })}
                  aria-label={t('AI 활용 표시 문구', 'AI disclosure text')}
                />
              )}
              {s.aiNotice?.on && <p className="text-[12px] text-muted">{t('비워 두면 위의 기본 문구를 씁니다. 바꿀 때는 문구에 “AI”나 “인공지능”을 넣어 주세요. 본문 끝에 “※ 문구” 모양으로 들어갑니다.', 'If left blank, the default text above is used. If you change it, include “AI” or “artificial intelligence” in the text. It is added at the end of the story in the form “※ text”.')}</p>}
            </div>
            <fieldset className="space-y-1.5 text-[13.5px]">
              <legend className="font-bold">{t('해외 언론 자료 받기', 'Receive international press material')}</legend>
              <p className="text-[12px] text-muted">{t('보도자료함에 영문 기사 요약을 함께 보여주고, AI가 출처를 밝힌 한국어 기사 초안으로 씁니다. 매체 분야에 맞는 묶음만 고르세요.', 'Shows English story summaries in the press release inbox, and AI writes a Korean story draft that credits the source. Choose only the groups that fit your outlet\'s field.')}</p>
              {FOREIGN_TOPICS.map((ft) => {
                const on = foreignTopics(s).includes(ft.key)
                return (
                  <label key={ft.key} className="flex items-start gap-2">
                    <input
                      type="checkbox" checked={on} className="mt-1"
                      onChange={(e) => {
                        const next = foreignTopics(s).filter((k) => k !== ft.key).concat(e.target.checked ? [ft.key] : [])
                        set({ pressForeignTopics: next, pressForeign: next.length > 0 })
                      }}
                    />
                    <span><strong>{lang === 'en' ? FOREIGN_EN[ft.key]?.label ?? ft.label : ft.label}</strong> <span className="text-[12px] text-muted">{lang === 'en' ? FOREIGN_EN[ft.key]?.hint ?? ft.hint : ft.hint}</span></span>
                  </label>
                )
              })}
            </fieldset>
            {!self && <Field label={t('쇼핑몰 주소', 'Shop URL')} hint={t("SHOP 메뉴·띠에서 연결할 주소 (없으면 '오픈 준비 중')", 'Address linked from the SHOP menu and strip (shows “Opening soon” if empty)')}><input value={s.shopUrl ?? ''} onChange={(e) => set({ shopUrl: e.target.value })} maxLength={300} placeholder="https://" className="field-input" /></Field>}
          </div>
        </div>
      </Card>

      <Card title={t('탭 아이콘 · 공유 미리보기', 'Tab icon · Share preview')}>
        <div className="grid gap-6 sm:grid-cols-2">
          <ImageSlot
            label={t('탭 아이콘 (파비콘)', 'Tab icon (favicon)')}
            hint={t('브라우저 탭·검색 결과에 작게 나오는 정사각형 그림 (512×512 PNG 추천). 비우면 로고를 씁니다.', 'A small square image shown in browser tabs and search results (512×512 PNG recommended). If empty, the logo is used.')}
            value={s.iconUrl}
            onChange={(v) => set({ iconUrl: v })}
            outletId={outlet.id}
            boxClass="h-20 w-20"
            previewTab={name}
          />
          <ImageSlot
            label={t('공유 미리보기 사진', 'Share preview image')}
            hint={t('카카오톡·페이스북 등에 홈페이지 주소를 올릴 때 나오는 큰 그림 (1200×630 JPG·PNG 추천). 기사는 기사 대표 사진이 먼저 나옵니다.', 'A large image shown when the website address is shared on KakaoTalk, Facebook and others (1200×630 JPG or PNG recommended). For stories, the story\'s lead photo is used first.')}
            value={s.ogImage}
            onChange={(v) => set({ ogImage: v })}
            outletId={outlet.id}
            boxClass="h-[84px] w-40"
          />
        </div>
        <details className="mt-4 rounded-lg border border-line bg-[#F8F9FA] px-4 py-3 text-[13px] leading-relaxed">
          <summary className="cursor-pointer font-semibold">{t('공유 사진을 바꿨는데 카카오톡에서 예전 사진이 나와요', 'I changed the share image but KakaoTalk still shows the old one')}</summary>
          {lang === 'en' ? (
            <div className="mt-2 space-y-2 text-muted">
              <p>Once an address has been shared, KakaoTalk, Facebook, Naver and others <strong className="text-body">store (cache)</strong> the image from that moment and keep showing it for days to weeks. Even if you change the image here, addresses that were already shared may not change right away, and the new image shows correctly first on addresses that have not been shared yet.</p>
              <p className="font-semibold text-body">How to clear the stored old image</p>
              <ul className="list-disc space-y-1 pl-5">
                <li><strong className="text-body">KakaoTalk</strong>: enter the website address in the <a href="https://developers.kakao.com/tool/debugger/sharing" target="_blank" rel="noopener" className="underline underline-offset-2">Kakao Developers → Tools → Sharing Debugger</a> and press <strong className="text-body">Debug → Reset</strong>. A Kakao account login is required; if it asks you to register the domain, ask the IM Newsroom team (Support).</li>
                <li><strong className="text-body">Facebook</strong>: enter the address in the <a href="https://developers.facebook.com/tools/debug/" target="_blank" rel="noopener" className="underline underline-offset-2">Sharing Debugger</a> and press <strong className="text-body">Scrape Again</strong>.</li>
                <li><strong className="text-body">Naver, text messages, messengers and the rest</strong>: there is nowhere to clear it, but it updates by itself after a few days.</li>
                <li><strong className="text-body">Fastest way</strong>: add any characters to the end of the address you share, and it is treated as a new address and the image is fetched again. Example: <code>https://youraddress.com/?v=2</code></li>
              </ul>
              <p>Browsers also remember the tab icon, so after changing it you may need to refresh (Cmd+Shift+R) or close and reopen the tab to see it.</p>
            </div>
          ) : (
          <div className="mt-2 space-y-2 text-muted">
            <p>카카오톡·페이스북·네이버 등은 주소를 한 번 공유하면 그때의 사진을 <strong className="text-body">저장(캐시)해 두고</strong> 며칠~몇 주 동안 그대로 보여 줍니다. 여기서 사진을 바꿔도 이미 공유된 주소는 바로 바뀌지 않을 수 있고, 새로 올린 사진은 아직 공유하지 않은 주소부터 정상으로 나옵니다.</p>
            <p className="font-semibold text-body">저장된 예전 사진 지우는 방법</p>
            <ul className="list-disc space-y-1 pl-5">
              <li><strong className="text-body">카카오톡</strong>: <a href="https://developers.kakao.com/tool/debugger/sharing" target="_blank" rel="noopener" className="underline underline-offset-2">카카오 디벨로퍼스 → 도구 → 공유 디버거</a>에 홈페이지 주소를 넣고 <strong className="text-body">디버그 → 초기화</strong>를 누르세요. 카카오 계정 로그인이 필요하고, 도메인 등록을 요구하면 운영팀(고객센터)에 요청해 주세요.</li>
              <li><strong className="text-body">페이스북</strong>: <a href="https://developers.facebook.com/tools/debug/" target="_blank" rel="noopener" className="underline underline-offset-2">공유 디버거</a>에 주소를 넣고 <strong className="text-body">다시 스크랩(Scrape Again)</strong>을 누르세요.</li>
              <li><strong className="text-body">네이버·문자·메신저 등 나머지</strong>: 따로 지우는 곳이 없어 며칠 지나면 저절로 바뀝니다.</li>
              <li><strong className="text-body">가장 빠른 방법</strong>: 공유할 주소 뒤에 아무 글자를 붙이면 새 주소로 보고 사진을 새로 가져옵니다. 예) <code>https://내주소.kr/?v=2</code></li>
            </ul>
            <p>탭 아이콘도 브라우저가 기억하고 있어, 바꾼 뒤 새로고침(Cmd+Shift+R)을 하거나 탭을 닫았다 다시 열어야 보일 수 있습니다.</p>
          </div>
          )}
        </details>
      </Card>

      <Card title={t('로고', 'Logo')}>
        <div className="flex flex-wrap items-start gap-6">
          <div className="grid h-24 w-40 place-items-center rounded border border-dashed border-line bg-[#F8F9FA] p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {s.logoUrl ? <img src={s.logoUrl} alt={t('현재 로고', 'Current logo')} className="max-h-full max-w-full object-contain" /> : <span className="text-[12px] text-muted">{t('로고 없음', 'No logo')}</span>}
          </div>
          <div className="space-y-3">
            <div className="flex gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary">{uploading ? t('올리는 중…', 'Uploading…') : t('로고 이미지 올리기', 'Upload logo image')}</button>
              {s.logoUrl && <button type="button" onClick={() => set({ logoUrl: undefined, logoMode: 'text' })} className="text-[12.5px] text-muted underline underline-offset-2">{t('로고 빼기', 'Remove logo')}</button>}
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => pickLogo(e.target.files)} />
            </div>
            <fieldset className="space-y-1.5 text-[13.5px]">
              <legend className="field-label">{t('표시 방식', 'Display style')}</legend>
              {([
                ['mark', t('심볼 + 매체 이름 글자 (더케어타임즈처럼)', 'Symbol + outlet name text (like The Care Times)')],
                ['full', t('로고 이미지만 (이미지에 이름까지 들어 있을 때)', 'Logo image only (when the image already includes the name)')],
                ['text', t('매체 이름 글자만', 'Outlet name text only')],
              ] as [LogoMode, string][]).map(([v, label]) => (
                <label key={v} className="flex items-center gap-2">
                  <input type="radio" name="logoMode" checked={(s.logoMode ?? 'mark') === v} onChange={() => set({ logoMode: v })} disabled={v !== 'text' && !s.logoUrl} />
                  {label}
                </label>
              ))}
            </fieldset>
            <fieldset className="space-y-1.5 text-[13.5px]">
              <legend className="field-label">{t('로고 크기', 'Logo size')}</legend>
              <div className="flex flex-wrap gap-x-5 gap-y-1.5">
                {([['normal', t('보통', 'Normal')], ['large', t('크게', 'Large')], ['xlarge', t('아주 크게', 'Extra large')]] as [LogoSize, string][]).map(([v, label]) => (
                  <label key={v} className="flex items-center gap-2">
                    <input type="radio" name="logoSize" checked={(s.logoSize ?? 'normal') === v} onChange={() => set({ logoSize: v })} />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="text-[11.5px] text-muted">{t('배경이 투명한 PNG를 추천합니다. 올린 이미지의 빈 여백은 자동으로 잘라 냅니다. 그래도 작아 보이면 로고 크기를 키우세요(미리보기에 바로 반영됩니다). 가로로 긴 로고는 “로고 이미지만”을 고르세요.', 'A PNG with a transparent background is recommended. Empty margins around the uploaded image are trimmed automatically. If it still looks small, increase the logo size (the preview updates right away). For wide logos, choose “Logo image only”.')}</p>
          </div>
        </div>
      </Card>

      <Card title={t('색', 'Colors')} note={t('대표색은 메뉴 줄·제목, 보조색은 강조선·배지에 쓰입니다. 진한 색은 자동으로 만들어집니다.', 'The main color is used for the menu bar and headings, and the accent color for highlight lines and badges. Darker shades are generated automatically.')}>
        <div className="flex flex-wrap items-end gap-5">
          <Field label={t('대표색', 'Main color')}>
            <span className="flex items-center gap-2">
              <input type="color" value={s.colors?.brand} onChange={(e) => set({ colors: { ...s.colors, brand: e.target.value } })} className="h-10 w-14 cursor-pointer rounded border border-line" />
              <code className="text-[12.5px]">{s.colors?.brand}</code>
            </span>
          </Field>
          <Field label={t('보조색', 'Accent color')}>
            <span className="flex items-center gap-2">
              <input type="color" value={s.colors?.accent} onChange={(e) => set({ colors: { ...s.colors, accent: e.target.value } })} className="h-10 w-14 cursor-pointer rounded border border-line" />
              <code className="text-[12.5px]">{s.colors?.accent}</code>
            </span>
          </Field>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button key={p.label} type="button" onClick={() => set({ colors: { brand: p.brand, accent: p.accent } })} className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[12px] hover:border-ink">
                <span className="h-3.5 w-3.5 rounded-full" style={{ background: p.brand }} />
                <span className="h-3.5 w-3.5 rounded-full" style={{ background: p.accent }} />
                {lang === 'en' ? PRESET_LABEL_EN[p.label] ?? p.label : p.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card title={t('로고 띠 (협력·후원 기관)', 'Logo strip (partners & sponsors)')} note={t('홈페이지 맨 아래에 로고가 오른쪽에서 왼쪽으로 천천히 흐릅니다. 마우스를 올리면 멈추고, 로고를 누르면 그 기관 사이트가 새 창으로 열립니다. 비워 두면 나오지 않습니다.', 'At the very bottom of the website, logos scroll slowly from right to left. They pause on hover, and clicking a logo opens that organization\'s site in a new window. If left empty, nothing is shown.')}>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <Field label={t('띠 제목 (선택)', 'Strip title (optional)')} hint={t('예: 함께하는 기관', 'e.g. Our partners')}>
              <input value={s.logoStrip?.title ?? ''} maxLength={30} onChange={(e) => set({ logoStrip: { ...(s.logoStrip ?? { items: [] }), title: e.target.value } })} className="field-input" />
            </Field>
            <Field label={t('흐르는 속도', 'Scroll speed')}>
              <select value={s.logoStrip?.speed ?? 'normal'} onChange={(e) => set({ logoStrip: { ...(s.logoStrip ?? { items: [] }), speed: e.target.value as 'slow' | 'normal' | 'fast' } })} className="field-input">
                <option value="slow">{t('느리게', 'Slow')}</option><option value="normal">{t('보통', 'Normal')}</option><option value="fast">{t('빠르게', 'Fast')}</option>
              </select>
            </Field>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {(s.logoStrip?.items ?? []).map((it, i) => (
              <li key={i} className="flex flex-col gap-1.5 rounded-lg border border-line p-2 text-[13px]">
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <span className="grid h-10 w-20 shrink-0 place-items-center rounded border border-line bg-white p-1">{it.img ? <img src={it.img} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-[11px] text-muted">{t('없음', 'None')}</span>}</span>
                  <input value={it.name} maxLength={40} onChange={(e) => setStripItem(i, { name: e.target.value })} placeholder={t('기관 이름', 'Organization name')} className="field-input min-w-0 flex-1 py-1.5" aria-label={t('기관 이름', 'Organization name')} />
                </div>
                <input value={it.url ?? ''} maxLength={300} onChange={(e) => setStripItem(i, { url: e.target.value })} inputMode="url" placeholder={t('누르면 갈 주소  https://기관-홈페이지.com', 'Link address  https://organization-website.com')} className={`field-input w-full py-1.5 ${it.url?.trim() ? '' : 'border-draft'}`} aria-label={t('누르면 갈 주소', 'Link address')} />
                <div className="flex items-center justify-between gap-1">
                  <label className="btn-secondary cursor-pointer px-2.5 py-1 text-[12px]">
                    {it.img ? t('로고 바꾸기', 'Change logo') : t('로고 올리기', 'Upload logo')}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { void pickStripLogo(i, e.target.files); e.target.value = '' }} />
                  </label>
                  <span className="flex gap-1">
                    <button type="button" disabled={i === 0} onClick={() => moveStripItem(i, -1)} className="rounded border border-line px-2 py-0.5 disabled:opacity-30" aria-label={t('앞으로', 'Move earlier')}>←</button>
                    <button type="button" disabled={i === (s.logoStrip?.items.length ?? 0) - 1} onClick={() => moveStripItem(i, 1)} className="rounded border border-line px-2 py-0.5 disabled:opacity-30" aria-label={t('뒤로', 'Move later')}>→</button>
                    <button type="button" onClick={() => set({ logoStrip: { ...(s.logoStrip ?? { items: [] }), items: (s.logoStrip?.items ?? []).filter((_, j) => j !== i) } })} className="rounded border border-line px-2 py-0.5 text-danger" aria-label={t('빼기', 'Remove')}>×</button>
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {!self && <GovPicker items={stripItems} onChange={putStrip} />}
          {!self && <GovLogoFinder items={stripItems} onChange={putStrip} outletId={outlet.id} />}
          {(s.logoStrip?.items.length ?? 0) < 40 && (
            <label className="btn-secondary inline-block cursor-pointer px-4 py-2 text-[13px]">
              {t('+ 로고 올려 추가', '+ Upload logos to add')} {uploading && t('(올리는 중…)', '(uploading…)')}
              <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { void addStripLogos(e.target.files); e.target.value = '' }} />
            </label>
          )}
          <p className="text-[12px] text-muted">{t('로고 이미지는 가로로 긴 모양(가로 140 × 세로 64 정도) 배경이 흰색이거나 투명한 파일이 가장 보기 좋습니다. 최대 40개까지 넣을 수 있습니다. 로고를 올리면 줄마다 “누르면 갈 주소” 칸이 생깁니다. 주소(https://…)를 적으면 로고를 눌렀을 때 그 사이트가 새 창으로 열리고, 비워 두면 눌러도 이동하지 않습니다(빈 칸은 주황색 테두리로 표시).', 'Logo images look best when they are wide (about 140 × 64) with a white or transparent background. You can add up to 40. Each uploaded logo gets a “Link address” field. If you enter an address (https://…), clicking the logo opens that site in a new window; if left empty, clicking does nothing (empty fields are shown with an orange border).')}</p>
          {cleanLogoStrip(s.logoStrip) && (
            <div className="pointer-events-none overflow-hidden rounded-lg border border-line" aria-hidden>
              <LogoStrip strip={cleanLogoStrip(s.logoStrip)!} />
            </div>
          )}
        </div>
      </Card>

      <Card title={t('메뉴(섹션)', 'Menu (sections)')} note={lang === 'en' ? <>The menu follows the order of the sections created under <a href="/admin/categories" className="underline underline-offset-2">Section menu</a>. Sections marked as “Specialty section” are grouped separately on the right of the menu and appear as specialty section tabs on the home page.</> : <>메뉴는 <a href="/admin/categories" className="underline underline-offset-2">섹션 메뉴</a>에서 만든 섹션 순서 그대로 나옵니다. “전문 섹션”으로 표시하면 메뉴 오른쪽에 따로 모이고, 첫 화면에 전문 섹션 탭으로 나옵니다.</>}>
        {sections.length ? (
          <ul className="divide-y divide-line rounded border border-line">
            {sections.map((c, i) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13.5px]">
                <span className="w-32 font-semibold">{c.name}</span>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={!!c.specialty} onChange={(e) => setSections(sections.map((x, j) => (j === i ? { ...x, specialty: e.target.checked } : x)))} />
                  {t('전문 섹션', 'Specialty section')}
                </label>
                {c.specialty && (
                  <input value={c.description ?? ''} onChange={(e) => setSections(sections.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} placeholder={t('짧은 설명 (예: 요양병원·요양시설 소식)', 'Short description (e.g. news on nursing hospitals and care facilities)')} maxLength={100} className="field-input min-w-[240px] flex-1 py-1.5" />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted">{t('섹션이 없습니다. 섹션 메뉴에서 먼저 만들어 주세요.', 'There are no sections. Create them first in the Section menu.')}</p>
        )}
      </Card>

      <Card title={t('하단 표시 정보', 'Footer information')} note={t('인터넷신문은 제호·등록번호·등록일·발행인·편집인·발행소 주소·전화, 청소년보호책임자를 홈페이지에 표시해야 합니다(* 표시).', 'Under Korean law, an online newspaper must display on its website its masthead title, registration number and date, publisher, editor, publishing address and phone, and its youth protection officer (marked with *).')}>
        <div className="grid gap-4 sm:grid-cols-3">
          {LEGAL.map((f) => (
            <div key={f.k} className={f.wide ? 'sm:col-span-2' : ''}>
              <Field label={<>{legalLabel(f)}{f.required && <span className="text-danger"> *</span>}</>}>
                <input value={s.legal?.[f.k] ?? ''} onChange={(e) => setLegal(f.k, e.target.value)} placeholder={lang === 'en' ? LEGAL_EN[f.k].ph : f.ph} className="field-input" />
              </Field>
            </div>
          ))}
        </div>
        {missing.length > 0 && <p className="mt-3 rounded bg-draft/10 px-3 py-2 text-[12.5px] text-[#6B5F22]">⚠ {t('아직 비어 있는 필수 항목:', 'Required fields still empty:')} {missing.map((m) => legalLabel(m)).join(', ')}</p>}
      </Card>

      {!self && (
        <>
      <Card title={t('보도자료 추천', 'Press release recommendations')} note={t('보도자료함 ‘추천’ 탭에 보여줄 자료를 정합니다. ‘전체’ 탭에는 언제나 모든 자료가 나옵니다.', 'Choose what appears in the “Recommended” tab of the press release inbox. The “All” tab always shows everything.')}>
        <fieldset className="space-y-1.5 text-[13.5px]">
          <legend className="font-bold">{t('매체 분야', 'Outlet field')}</legend>
          <p className="text-[12px] text-muted">{t('고른 분야의 뉴스와이어 분류만 추천에 나옵니다. 정부·공공기관 보도자료는 제목에 아래 키워드가 있을 때만 나옵니다.', 'Only Newswire categories for the chosen fields appear in recommendations. Government and public agency press releases appear only when the title contains one of the keywords below.')}</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {PRESS_FIELDS.map((f) => {
              const now = pressFields(s, keywordList)
              return (
                <label key={f.key} className="flex items-center gap-2">
                  <input type="checkbox" checked={now.includes(f.key)} onChange={(e) => set({ pressFields: now.filter((k) => k !== f.key).concat(e.target.checked ? [f.key] : []) })} />
                  <strong>{lang === 'en' ? PRESS_FIELD_EN[f.key] ?? f.label : f.label}</strong>
                </label>
              )
            })}
          </div>
        </fieldset>
        <div className="mt-4">
          <p className="text-[13.5px] font-bold">{t('추천 키워드', 'Recommendation keywords')}</p>
          <p className="mb-1.5 text-[12px] text-muted">{t('제목에 이 단어가 들어간 정부·공공기관 보도자료를 추천에 넣습니다(분야를 고르지 않았다면 모든 출처에서). 쉼표로 구분합니다. 3글자 이하 영문 약어(IB, AI 등)는 다른 단어에 섞여 걸리기 쉬워 쓰지 않습니다.', 'Government and public agency press releases whose title contains these words are added to recommendations (from all sources if no field is chosen). Separate with commas. English abbreviations of 3 letters or fewer (IB, AI, etc.) are not used because they easily match inside other words.')}</p>
          <textarea value={s.pressKeywords ?? ''} onChange={(e) => set({ pressKeywords: e.target.value })} rows={3} placeholder={t('예: 요양, 돌봄, 복지, 병원', 'e.g. 요양, 돌봄, 복지, 병원 (enter the words as they appear in Korean titles)')} className="field-input resize-y" />
        </div>
      </Card>

      <Card title={t('오픈 준비 중', 'Opening soon')}>
        <label className="flex items-start gap-3 text-[14px]">
          <input type="checkbox" checked={!!s.comingSoon} onChange={(e) => set(e.target.checked ? { comingSoon: true, ...(openTimePassed(s) ? { openAt: undefined } : {}) } : { comingSoon: undefined })} className="mt-1" />
          <span>
            <strong>{t('오픈 준비 중 (방문자에게는 안내 화면만 보이기)', 'Opening soon (visitors see only a notice page)')}</strong>
            <span className="mt-0.5 block text-[12.5px] text-muted">{lang === 'en' ? <>While on, visitors arriving at the domain see only an “Opening soon” page, and search engine crawling is blocked. We and the customer can see the real website through the “Website preview” link below. <strong>Turn it off on the official launch day</strong> (that day is the launch date and the day the first invoice is issued).</> : <>켜 두면 도메인으로 들어온 방문자에게 “오픈 준비 중입니다” 화면만 보이고, 검색엔진 수집도 막힙니다. 우리와 고객은 아래 “홈페이지 미리보기” 링크로 실제 홈페이지를 볼 수 있습니다. <strong>정식 오픈하는 날 끄세요</strong> (이날이 개통일이고 첫 청구서를 발행하는 날입니다).</>}</span>
          </span>
        </label>
        <div className="mt-4 rounded-lg border border-line p-3 text-[13.5px]">
          <p className="font-bold">{t('예약 오픈', 'Scheduled opening')} <span className="font-normal text-muted">{t('(정한 시각이 되면 위 스위치를 켜 둔 채로도 안내 화면이 저절로 풀리고 홈페이지가 열립니다)', '(at the set time the notice page lifts by itself and the website opens, even if the switch above is left on)')}</span></p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5"><span className="text-muted">{t('시간대', 'Time zone')}</span>
              <select value={s.openTz ?? 'Asia/Seoul'} onChange={(e) => { const tz = e.target.value; set({ openTz: tz, openAt: openLocal ? zonedToIso(openLocal, tz) ?? undefined : s.openAt }) }} className="field-input w-56 py-1">
                {OPEN_ZONES.map((z) => <option key={z.tz} value={z.tz}>{lang === 'en' ? z.en : z.label}</option>)}
              </select>
            </label>
            <label className="flex items-center gap-1.5"><span className="text-muted">{t('오픈 일시', 'Opening date and time')}</span>
              <DateTimeField value={openLocal} onChange={(v) => set({ openAt: v ? zonedToIso(v, s.openTz ?? 'Asia/Seoul') ?? undefined : undefined, openTz: s.openTz ?? 'Asia/Seoul' })} className="field-input w-56 py-1" />
            </label>
            {s.openAt && <button type="button" onClick={() => set({ openAt: undefined })} className="text-[12.5px] text-danger underline">{t('예약 취소', 'Cancel schedule')}</button>}
          </div>
          {s.openAt && Number.isFinite(Date.parse(s.openAt)) && (
            <p className="mt-2 text-[12.5px] leading-relaxed">
              {lang === 'en'
                ? <>Opens at <strong>{formatZoned(s.openAt, s.openTz ?? 'Asia/Seoul', 'en')}</strong>. In Korea time: {formatZoned(s.openAt, 'Asia/Seoul', 'en')}.</>
                : <><strong>{formatZoned(s.openAt, s.openTz ?? 'Asia/Seoul')}</strong>에 열립니다. 한국 시간으로는 {formatZoned(s.openAt, 'Asia/Seoul')}.</>}
              {Date.parse(s.openAt) <= Date.now() && (init.comingSoon
                ? <span className="font-semibold text-published"> {t('✓ 예약 시각이 지나 홈페이지는 이미 열려 있습니다. 위 스위치는 꺼진 것으로 보여 드립니다. 저장하면 설정에서도 꺼집니다.', '✓ The scheduled time has passed, so the website is already open. The switch above is shown as off. Saving turns it off in the settings too.')}</span>
                : <span className="text-muted"> {t('(이미 지난 시각입니다)', '(that time has already passed)')}</span>)}
            </p>
          )}
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{t('미리 해 둘 것: ① 위 “도메인”을 연결하고 DNS가 맞는지 확인 ② 아래 “검색 노출”을 켜고 저장(예약 시각에 검색 노출이 함께 적용됩니다) ③ 하단 표시 정보·기사·섹션 점검. 저장 후 오픈 시각까지 방문자에게는 “○월 ○일 오픈 예정” 안내 화면이 보입니다.', 'To do beforehand: (1) connect the “Domain” above and check that the DNS is correct; (2) turn on “Search visibility” below and save (search visibility is applied at the scheduled time); (3) check the footer information, stories and sections. After saving, until the opening time visitors see a notice page that says “Opening on [date]”.')}</p>
        </div>
        <p className="mt-3 text-[12.5px]"><a href={previewUrl(outlet.id)} target="_blank" rel="noopener" className="font-semibold text-review underline underline-offset-2">{t('홈페이지 미리보기 ↗', 'Website preview ↗')}</a><span className="ml-2 text-muted">{t('고객에게 보여 줄 때 이 링크를 보내세요.', 'Send this link when you show it to the customer.')}</span></p>
      </Card>

      <Card title={t('도메인', 'Domain')}>
        <Field label={t('홈페이지 주소', 'Website address')} hint={t('www 없이 적습니다. 예: thecaretimes.net', 'Enter it without www. Example: thecaretimes.net')}>
          <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder={t('예: seniornews.co.kr', 'e.g. seniornews.co.kr')} className="field-input max-w-sm" />
        </Field>
        <details className="mt-4 rounded bg-[#F8F9FA] px-4 py-3 text-[13px] leading-relaxed">
          <summary className="cursor-pointer font-semibold">{t('도메인 연결하는 방법', 'How to connect a domain')}</summary>
          {lang === 'en' ? (
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            <li>Enter the address in the field above and save.</li>
            <li>A <strong>Super Admin</strong> adds that address and the www address under Vercel → imcms project → Settings → Domains. (Ask for “connect domain” through a work request.)</li>
            <li>In the <strong>DNS record (A/CNAME) settings</strong> of the company where the domain was bought (Whois, HostingKR, Gabia, etc.), enter exactly the values shown on the Vercel Domains screen. Currently this is usually an <code>@</code> A record <code>216.150.1.1</code> and a <code>www</code> CNAME <code>…vercel-dns-017.com</code>. (The older values <code>76.76.21.21</code> and <code>cname.vercel-dns.com</code> still work for now, but using the values shown on screen is the safest.)</li>
            <li>If <code>@</code> or <code>www</code> rows already exist (for example the registrar&apos;s default address), <strong>edit that row instead of adding a new one</strong>. The same host must not have both an A and a CNAME record.</li>
            <li>At Whois, use the <strong>record (A/CNAME) settings inside the advanced nameserver settings</strong>, not “DNS host management” (the nameserver registration menu). Entering them under “DNS host management” will not connect.</li>
            <li>Usually within a few minutes to a few hours, opening the address shows this outlet&apos;s website. Press Refresh on the Vercel Domains screen to check the connection status.</li>
          </ol>
          ) : (
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            <li>위 칸에 주소를 적고 저장합니다.</li>
            <li><strong>총관리자</strong>가 Vercel → imcms 프로젝트 → Settings → Domains에서 그 주소와 www 주소를 추가합니다. (업무요청으로 “도메인 연결”을 요청하세요.)</li>
            <li>도메인을 산 곳(후이즈, 호스팅케이알, 가비아 등)의 <strong>DNS 레코드(A·CNAME) 설정</strong>에서, Vercel Domains 화면에 표시된 값을 그대로 넣습니다. 지금은 보통 <code>@</code> A 레코드 <code>216.150.1.1</code>, <code>www</code> CNAME <code>…vercel-dns-017.com</code> 형태입니다. (예전 값 <code>76.76.21.21</code>·<code>cname.vercel-dns.com</code>도 당분간 작동하지만, 화면에 나온 값을 쓰는 것이 가장 확실합니다.)</li>
            <li>이미 <code>@</code>·<code>www</code> 줄이 있으면(예: 도메인 업체 기본 주소) <strong>새로 추가하지 말고 그 줄을 수정</strong>합니다. 같은 호스트에 A와 CNAME이 같이 있으면 안 됩니다.</li>
            <li>후이즈는 “DNS 호스트 관리”(네임서버 등록 메뉴)가 아니라 <strong>네임서버 고급설정 안의 레코드(A·CNAME) 설정</strong>입니다. “DNS 호스트 관리”에 넣으면 연결되지 않습니다.</li>
            <li>보통 몇 분~몇 시간 뒤 주소로 들어가면 이 매체 홈페이지가 열립니다. Vercel Domains 화면에서 Refresh를 눌러 연결 상태를 확인합니다.</li>
          </ol>
          )}
        </details>
      </Card>

      <Card title={t('검색 노출', 'Search visibility')}>
        <label className="flex items-start gap-3 text-[14px]">
          <input type="checkbox" checked={!!s.indexable} onChange={(e) => set({ indexable: e.target.checked })} className="mt-1" />
          <span>
            <strong>{t('구글·네이버 검색에 노출하기', 'Show in Google and Naver search')}</strong>
            <span className="mt-0.5 block text-[12.5px] text-muted">{t('정식으로 여는 날 켜세요. 테스트 기사가 남아 있을 때 켜면 검색 결과에 그대로 남을 수 있습니다.', 'Turn this on on the official launch day. If you turn it on while test stories remain, they may stay in search results.')}</span>
          </span>
        </label>
        <fieldset className="mt-4 space-y-2 rounded-lg border border-line p-3 text-[13.5px]">
          <legend className="px-1 font-bold">{t('AI 크롤러 (ChatGPT·Claude 등 AI 회사의 수집 봇)', 'AI crawlers (collection bots of AI companies such as ChatGPT and Claude)')}</legend>
          <p className="text-[12px] text-muted">{t('기사가 AI 학습에 쓰이는 것을 매체가 정합니다. 구글·네이버 검색에는 영향이 없습니다. 규칙을 지키는 회사의 봇만 따르며, 이미 수집된 자료는 지워지지 않습니다. 저장 후 10분쯤 뒤부터 적용됩니다.', 'The outlet decides whether its stories are used for AI training. This does not affect Google or Naver search. Only bots from companies that follow the rules comply, and material already collected is not deleted. It takes effect about 10 minutes after saving.')}</p>
          {AI_BOT_MODES.map((m) => (
            <label key={m.key} className="flex items-start gap-2">
              <input type="radio" name="aiBots" checked={(s.aiBots ?? 'allow') === m.key} onChange={() => set({ aiBots: m.key })} className="mt-1" />
              <span><strong>{lang === 'en' ? AI_BOT_EN[m.key]?.label ?? m.label : m.label}</strong><span className="block text-[12px] text-muted">{lang === 'en' ? AI_BOT_EN[m.key]?.hint ?? m.hint : m.hint}</span></span>
            </label>
          ))}
          <p className="text-[12px] text-muted">{lang === 'en' ? <>To check: add <code>/robots.txt</code> after this outlet&apos;s address and open it to see the rules in effect. For outlets without search visibility turned on, all bots are already blocked.</> : <>확인: 이 매체 주소 뒤에 <code>/robots.txt</code>를 붙여 열면 적용된 규칙이 보입니다. 검색 노출을 켜지 않은 매체는 모든 봇이 이미 막혀 있습니다.</>}</p>
        </fieldset>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label={t('네이버 서치어드바이저 확인 코드', 'Naver Search Advisor verification code')} hint={t('“HTML 태그” 방식의 메타 태그를 통째로 붙여 넣어도 됩니다', 'You can paste the whole meta tag from the “HTML tag” method')}>
            <input value={s.naverVerification ?? ''} onChange={(e) => set({ naverVerification: e.target.value })} maxLength={300} placeholder='<meta name="naver-site-verification" content="…" />' className="field-input" />
          </Field>
          <Field label={t('구글 서치콘솔 확인 코드', 'Google Search Console verification code')} hint={t('“HTML 태그” 방식의 메타 태그를 통째로 붙여 넣어도 됩니다', 'You can paste the whole meta tag from the “HTML tag” method')}>
            <input value={s.googleVerification ?? ''} onChange={(e) => set({ googleVerification: e.target.value })} maxLength={300} placeholder='<meta name="google-site-verification" content="…" />' className="field-input" />
          </Field>
        </div>
        <SearchRegisterGuide outletId={outlet.id} domain={outlet.domain} />
      </Card>

        </>
      )}

      {/* 하단 미리보기 */}
      <section className="overflow-hidden rounded-lg border border-line bg-white">
        <p className="border-b border-line bg-[#F8F9FA] px-4 py-2 text-[12.5px] font-semibold">{t('하단 미리보기', 'Footer preview')}</p>
        <div className="pointer-events-none h-[260px] overflow-hidden" aria-hidden>
          <div className="site origin-top-left scale-[0.62]" style={{ ...vars, width: '161%' }}>
            <SiteFooter site={preview} />
          </div>
        </div>
      </section>

      <div className="cms-actionbar border-t border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[960px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 md:px-8 md:py-3">
          <p role={msg.error ? 'alert' : 'status'} className={`min-w-[12rem] flex-1 text-[13px] ${msg.error ? 'font-semibold text-danger' : msg.ok ? 'text-published' : 'text-muted'}`}>
            {msg.error ?? msg.ok ?? t('바꾼 내용은 저장해야 홈페이지에 반영됩니다.', 'Changes appear on the website only after you save.')}
          </p>
          <a href={previewUrl(outlet.id)} target="_blank" rel="noopener" className="btn-secondary">{t('홈페이지 미리보기', 'Website preview')}</a>
          <button type="button" onClick={save} disabled={pending || uploading} className="btn-publish px-6">{pending ? t('저장 중…', 'Saving…') : t('저장', 'Save')}</button>
        </div>
      </div>
    </div>
  )
}

// 홈 오른쪽 '숫자 판' 편집 (예: 선교 통계). 숫자마다 출처를 적는다
function StatsEditor({ value, onChange }: { value: OutletSiteSettings['statsBoard']; onChange: (v: OutletSiteSettings['statsBoard']) => void }) {
  const t = useT()
  const b = value ?? { title: '', items: [] }
  const items = b.items ?? []
  const put = (i: number, patch: Partial<(typeof items)[number]>) => onChange({ ...b, items: items.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
  return (
    <fieldset className="space-y-2 rounded-lg border border-line p-3 text-[13px]">
      <legend className="px-1 text-[13.5px] font-bold">{t('숫자 판', 'Numbers board')} <span className="font-normal text-muted">{t('(홈 오른쪽, 비워 두면 안 나옵니다)', '(right side of the home page; not shown if left empty)')}</span></legend>
      <input value={b.title ?? ''} onChange={(e) => onChange({ ...b, title: e.target.value })} maxLength={30} placeholder={t('제목 (예: 숫자로 보는 세계선교)', 'Title (e.g. World Missions by the Numbers)')} className="field-input" />
      {items.map((x, i) => (
        <div key={i} className="grid gap-1.5 rounded-md bg-paper/50 p-2 sm:grid-cols-[1fr_120px_1fr]">
          <input value={x.label} onChange={(e) => put(i, { label: e.target.value })} maxLength={40} placeholder={t('이름 (예: 한국 장기 선교사)', 'Label (e.g. Korean long-term missionaries)')} className="field-input" />
          <input value={x.value} onChange={(e) => put(i, { value: e.target.value })} maxLength={30} placeholder={t('숫자 (예: 21,621명)', 'Number (e.g. 21,621)')} className="field-input" />
          <input value={x.note ?? ''} onChange={(e) => put(i, { note: e.target.value })} maxLength={80} placeholder={t('덧붙임 (예: 171개국)', 'Note (e.g. 171 countries)')} className="field-input" />
          <input value={x.source ?? ''} onChange={(e) => put(i, { source: e.target.value })} maxLength={80} placeholder={t('출처 (예: KWMA·KRIM, 2024년 말)', 'Source (e.g. KWMA·KRIM, end of 2024)')} className="field-input sm:col-span-2" />
          <div className="flex gap-1.5">
            <input value={x.url ?? ''} onChange={(e) => put(i, { url: e.target.value })} maxLength={300} placeholder={t('출처 주소 (선택)', 'Source URL (optional)')} className="field-input min-w-0 flex-1" />
            <button type="button" onClick={() => onChange({ ...b, items: items.filter((_, j) => j !== i) })} className="shrink-0 px-2 text-danger underline">{t('빼기', 'Remove')}</button>
          </div>
        </div>
      ))}
      {items.length < 8 && <button type="button" onClick={() => onChange({ ...b, items: [...items, { label: '', value: '' }] })} className="btn-secondary">{t('+ 숫자 추가', '+ Add number')}</button>}
      <input value={b.footnote ?? ''} onChange={(e) => onChange({ ...b, footnote: e.target.value })} maxLength={200} placeholder={t('아래 작은 설명 (선택, 예: 집계 기준이 기관마다 다릅니다)', 'Small note below (optional, e.g. counting methods differ between organizations)')} className="field-input" />
    </fieldset>
  )
}

// 이미지 하나 올리고 빼는 칸 (탭 아이콘·공유 미리보기용)
function ImageSlot({ label, hint, value, onChange, outletId, boxClass, previewTab }: {
  label: string; hint: string; value?: string; onChange: (v: string | undefined) => void; outletId: string; boxClass: string; previewTab?: string
}) {
  const t = useT()
  const ref = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  async function pick(files: FileList | null) {
    const f = files?.[0]
    if (!f) return
    setBusy(true); setErr('')
    try { onChange(await uploadImage(f, outletId)) } catch (e) { setErr(e instanceof Error ? e.message : t('올리지 못했습니다.', 'Could not upload it.')) } finally { setBusy(false); if (ref.current) ref.current.value = '' }
  }
  return (
    <div>
      <p className="field-label">{label}</p>
      <div className="flex flex-wrap items-center gap-3">
        <div className={`grid place-items-center overflow-hidden rounded border border-dashed border-line bg-[#F8F9FA] ${boxClass}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {value ? <img src={value} alt="" className="h-full w-full object-contain" /> : <span className="text-[12px] text-muted">{t('없음', 'None')}</span>}
        </div>
        <div className="flex flex-col items-start gap-1.5">
          <button type="button" onClick={() => ref.current?.click()} disabled={busy} className="btn-secondary px-3 py-1.5 text-[13px]">{busy ? t('올리는 중…', 'Uploading…') : value ? t('바꾸기', 'Change') : t('이미지 올리기', 'Upload image')}</button>
          {value && <button type="button" onClick={() => onChange(undefined)} className="text-[12.5px] text-muted underline underline-offset-2">{t('빼기', 'Remove')}</button>}
          <input ref={ref} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => pick(e.target.files)} />
        </div>
        {previewTab && value && (
          <span className="flex items-center gap-1.5 rounded-t-lg border border-line bg-white px-2.5 py-1.5 text-[12px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="" className="h-4 w-4 object-contain" />
            <span className="max-w-[110px] truncate">{previewTab}</span>
          </span>
        )}
      </div>
      <p className={`mt-1.5 text-[12px] ${err ? 'text-danger' : 'text-muted'}`}>{err || hint}</p>
    </div>
  )
}
