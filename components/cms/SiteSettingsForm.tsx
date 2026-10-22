'use client'

import { useMemo, useRef, useState, useTransition, type CSSProperties, type ReactNode } from 'react'
import { AI_NOTICE_DEFAULT } from '@/lib/ai-notice'
import { AI_BOT_MODES } from '@/lib/ai-crawlers'
import { HOME_LAYOUTS } from '@/lib/home-layouts'
import { previewUrl } from '@/lib/product'
import HomeLayoutThumb from './HomeLayoutThumb'
import { useRouter } from 'next/navigation'
import { saveSiteSettings } from '@/app/(main)/admin/outlets/[id]/site/actions'
import SearchRegisterGuide from './SearchRegisterGuide'
import { buildSite, DEFAULT_COLORS, foreignTopics, pressFields, type CategoryRow, type LogoMode, type OutletSiteSettings, type SiteLegal } from '@/lib/sites'
import { FOREIGN_TOPICS, PRESS_FIELDS } from '@/lib/press-sources'
import { uploadImage } from '@/components/editor/upload'
import SiteHeader from '@/components/site/SiteHeader'
import SiteFooter from '@/components/site/SiteFooter'

type Section = CategoryRow & { id: string }
type Props = {
  outlet: { id: string; name: string; domain: string | null; site: OutletSiteSettings | null }
  sections: Section[]
  defaults: OutletSiteSettings
}

const PRESETS = [
  { brand: '#02472F', accent: '#D3A82B', label: '녹색·금색' },
  { brand: '#1F3A5F', accent: '#C9A227', label: '남색·금색' },
  { brand: '#8C1D2B', accent: '#1F2937', label: '버건디' },
  { brand: '#0B5CAD', accent: '#F59E0B', label: '파랑·주황' },
  { brand: '#1C1F26', accent: '#E5483A', label: '검정·빨강' },
  { brand: '#5B2A86', accent: '#E0A526', label: '보라·금색' },
]

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

export default function SiteSettingsForm({ outlet, sections: initialSections, defaults }: Props) {
  const router = useRouter()
  const init = { ...defaults, ...(outlet.site ?? {}) }
  const [name, setName] = useState(outlet.name)
  const [domain, setDomain] = useState(outlet.domain ?? '')
  const [s, setS] = useState<OutletSiteSettings>({
    ...init,
    colors: { brand: init.colors?.brand ?? DEFAULT_COLORS.brand, accent: init.colors?.accent ?? DEFAULT_COLORS.accent },
    legal: { ...(defaults.legal ?? {}), ...(outlet.site?.legal ?? {}) },
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
    () => buildSite({ id: outlet.id, name: name || '매체 이름', domain: domain || null, site: s }, sections),
    [outlet.id, name, domain, s, sections]
  )
  const vars = { '--brand': preview.colors.brand, '--brand-dark': preview.colors.brandDark, '--gold': preview.colors.gold, '--gold-ink': preview.colors.goldInk } as CSSProperties
  const missing = LEGAL.filter((f) => f.required && !s.legal?.[f.k]?.trim())

  async function pickLogo(files: FileList | null) {
    const f = files?.[0]
    if (!f) return
    setUploading(true)
    try {
      const url = await uploadImage(f, outlet.id)
      set({ logoUrl: url, logoMode: s.logoMode === 'text' ? 'mark' : s.logoMode })
    } catch (e) {
      window.alert(e instanceof Error ? e.message : '로고를 올리지 못했습니다.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const save = () => start(async () => {
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
          <span className="font-semibold">미리보기 <span className="font-normal text-muted">(PC 화면 머리 부분, 저장 전에도 바로 바뀝니다)</span></span>
          <a href={previewUrl(outlet.id)} target="_blank" rel="noopener" className="font-semibold text-review underline underline-offset-2">저장한 홈페이지 전체 보기 ↗</a>
        </div>
        <div className="pointer-events-none h-[118px] overflow-hidden" aria-hidden>
          <div className="site origin-top-left scale-[0.62]" style={{ ...vars, width: '161%' }}>
            <SiteHeader site={preview} />
          </div>
        </div>
      </section>

      <Card title="기본 정보">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="매체 이름 (제호)"><input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="field-input" /></Field>
          <Field label="영문 이름" hint="로고 아래 작은 글자 (비워도 됨)"><input value={s.nameEn ?? ''} onChange={(e) => set({ nameEn: e.target.value })} maxLength={60} placeholder="예: THE CARE TIMES" className="field-input" /></Field>
          <Field label="슬로건" hint="메뉴·하단에 표시"><input value={s.slogan ?? ''} onChange={(e) => set({ slogan: e.target.value })} maxLength={80} className="field-input" /></Field>
          <Field label="영문 슬로건"><input value={s.sloganEn ?? ''} onChange={(e) => set({ sloganEn: e.target.value })} maxLength={80} className="field-input" /></Field>
          <div className="space-y-4 sm:col-span-2">
            <Field label="매체 소개" hint="검색 결과·공유할 때 나오는 설명 (160자 이내 권장)"><input value={s.description ?? ''} onChange={(e) => set({ description: e.target.value })} maxLength={200} className="field-input" /></Field>
            <Field label="전문뉴스 제목" hint="첫 화면 전문 섹션 묶음의 제목 (예: 국제물류 전문뉴스)"><input value={s.specialtyTitle ?? ''} onChange={(e) => set({ specialtyTitle: e.target.value })} maxLength={30} placeholder="전문뉴스" className="field-input" /></Field>
            <label className="flex items-start gap-2 text-[13.5px]">
              <input type="checkbox" checked={!!s.indexWidget} onChange={(e) => set({ indexWidget: e.target.checked })} className="mt-1" />
              <span><strong>해운 운임지수 위젯</strong> (SCFI·KCCI 주간 그래프를 홈 오른쪽에 표시) <span className="block text-[12px] text-muted">켜면 편집국 “홈편집”에서 매주 지수 값을 입력할 수 있습니다.</span></span>
            </label>
            <StatsEditor value={s.statsBoard} onChange={(statsBoard) => set({ statsBoard })} />
            <fieldset className="space-y-2 text-[13.5px]">
              <legend className="font-bold">홈페이지 배치</legend>
              <p className="text-[12px] text-muted">첫 화면의 모양을 고릅니다. 기사·로고·색은 그대로이고 배치만 바뀝니다. <strong>미리보기</strong>는 저장하지 않아도 이 매체의 실제 기사로 새 창에 보여 주며, 그 주소를 고객에게 보내 함께 고를 수도 있습니다. 저장하면 홈페이지에 바로 적용됩니다.</p>
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                {HOME_LAYOUTS.map((l) => {
                  const on = (s.homeLayout ?? 'standard') === l.key
                  return (
                    <label key={l.key} className={`flex flex-col gap-2 rounded-lg border p-3 ${l.ready ? 'cursor-pointer' : 'cursor-not-allowed opacity-55'} ${on ? 'border-ink ring-1 ring-ink' : 'border-line'}`}>
                      <HomeLayoutThumb layout={l.key} />
                      <span className="flex items-center gap-2">
                        <input type="radio" name="homeLayout" checked={on} disabled={!l.ready} onChange={() => set({ homeLayout: l.key })} />
                        <strong>{l.name}</strong><span className="text-muted">· {l.label}</span>
                        {!l.ready && <span className="ml-auto rounded bg-line px-1.5 py-0.5 text-[11px] text-muted">준비 중</span>}
                        {l.ready && (
                          <a href={previewUrl(outlet.id, l.key)} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} className="ml-auto whitespace-nowrap rounded border border-line px-2 py-0.5 text-[12px] font-semibold text-ink hover:border-ink">미리보기 ↗</a>
                        )}
                      </span>
                      <span className="text-[12px] leading-snug text-muted">{l.features}</span>
                    </label>
                  )
                })}
              </div>
              {s.homeLayout === 'bands' && <p className="text-[12px] text-muted">섹션 띠는 섹션 순서대로 자동으로 만들어집니다{s.bands?.length ? ` (지금 ${s.bands.length}개 띠 설정됨)` : ''}. 띠 순서·모양을 따로 정하려면 운영팀에 요청하세요.</p>}
            </fieldset>
            <label className="flex items-start gap-2 text-[13.5px]">
              <input type="checkbox" checked={s.lang === 'en'} onChange={(e) => set({ lang: e.target.checked ? 'en' : 'ko' })} className="mt-1" />
              <span><strong>영문 홈페이지</strong> (메뉴·날짜·안내 문구·개인정보처리방침을 영어로) <span className="block text-[12px] text-muted">기사는 쓴 언어 그대로 나갑니다. 해외 독자를 위한 영문 매체에 켜세요.</span></span>
            </label>
            <div className="space-y-1.5 rounded-lg border border-line p-3 text-[13.5px]">
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={!!s.aiNotice?.on} onChange={(e) => set({ aiNotice: { ...s.aiNotice, on: e.target.checked } })} className="mt-1" />
                <span><strong>AI 활용 표시</strong> (AI 초안으로 만든 기사 본문 끝에 아래 문구를 자동으로 넣기) <span className="block text-[12px] text-muted">네이버 뉴스제휴 운영평가는 AI로 만든 글·사진을 표시하지 않으면 벌점(0.5점)입니다. 넣은 문구는 기사 편집 화면에서 지울 수 있습니다. <a href="/support/guide#ai" target="_blank" className="underline">기사 작성 가이드</a></span></span>
              </label>
              {s.aiNotice?.on && (
                <input
                  value={s.aiNotice?.text ?? ''} maxLength={150} className="field-input"
                  placeholder={AI_NOTICE_DEFAULT[s.lang === 'en' ? 'en' : 'ko']}
                  onChange={(e) => set({ aiNotice: { on: true, text: e.target.value } })}
                  aria-label="AI 활용 표시 문구"
                />
              )}
              {s.aiNotice?.on && <p className="text-[12px] text-muted">비워 두면 위의 기본 문구를 씁니다. 바꿀 때는 문구에 “AI”나 “인공지능”을 넣어 주세요. 본문 끝에 “※ 문구” 모양으로 들어갑니다.</p>}
            </div>
            <fieldset className="space-y-1.5 text-[13.5px]">
              <legend className="font-bold">해외 언론 자료 받기</legend>
              <p className="text-[12px] text-muted">보도자료함에 영문 기사 요약을 함께 보여주고, AI가 출처를 밝힌 한국어 기사 초안으로 씁니다. 매체 분야에 맞는 묶음만 고르세요.</p>
              {FOREIGN_TOPICS.map((t) => {
                const on = foreignTopics(s).includes(t.key)
                return (
                  <label key={t.key} className="flex items-start gap-2">
                    <input
                      type="checkbox" checked={on} className="mt-1"
                      onChange={(e) => {
                        const next = foreignTopics(s).filter((k) => k !== t.key).concat(e.target.checked ? [t.key] : [])
                        set({ pressForeignTopics: next, pressForeign: next.length > 0 })
                      }}
                    />
                    <span><strong>{t.label}</strong> <span className="text-[12px] text-muted">{t.hint}</span></span>
                  </label>
                )
              })}
            </fieldset>
            <Field label="쇼핑몰 주소" hint="SHOP 메뉴·띠에서 연결할 주소 (없으면 '오픈 준비 중')"><input value={s.shopUrl ?? ''} onChange={(e) => set({ shopUrl: e.target.value })} maxLength={300} placeholder="https://" className="field-input" /></Field>
          </div>
        </div>
      </Card>

      <Card title="로고">
        <div className="flex flex-wrap items-start gap-6">
          <div className="grid h-24 w-40 place-items-center rounded border border-dashed border-line bg-[#F8F9FA] p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {s.logoUrl ? <img src={s.logoUrl} alt="현재 로고" className="max-h-full max-w-full object-contain" /> : <span className="text-[12px] text-muted">로고 없음</span>}
          </div>
          <div className="space-y-3">
            <div className="flex gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-secondary">{uploading ? '올리는 중…' : '로고 이미지 올리기'}</button>
              {s.logoUrl && <button type="button" onClick={() => set({ logoUrl: undefined, logoMode: 'text' })} className="text-[12.5px] text-muted underline underline-offset-2">로고 빼기</button>}
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => pickLogo(e.target.files)} />
            </div>
            <fieldset className="space-y-1.5 text-[13.5px]">
              <legend className="field-label">표시 방식</legend>
              {([
                ['mark', '심볼 + 매체 이름 글자 (더케어타임즈처럼)'],
                ['full', '로고 이미지만 (이미지에 이름까지 들어 있을 때)'],
                ['text', '매체 이름 글자만'],
              ] as [LogoMode, string][]).map(([v, label]) => (
                <label key={v} className="flex items-center gap-2">
                  <input type="radio" name="logoMode" checked={(s.logoMode ?? 'mark') === v} onChange={() => set({ logoMode: v })} disabled={v !== 'text' && !s.logoUrl} />
                  {label}
                </label>
              ))}
            </fieldset>
            <p className="text-[11.5px] text-muted">배경이 투명한 PNG를 추천합니다. 가로로 긴 로고는 “로고 이미지만”을 고르세요.</p>
          </div>
        </div>
      </Card>

      <Card title="색" note="대표색은 메뉴 줄·제목, 보조색은 강조선·배지에 쓰입니다. 진한 색은 자동으로 만들어집니다.">
        <div className="flex flex-wrap items-end gap-5">
          <Field label="대표색">
            <span className="flex items-center gap-2">
              <input type="color" value={s.colors?.brand} onChange={(e) => set({ colors: { ...s.colors, brand: e.target.value } })} className="h-10 w-14 cursor-pointer rounded border border-line" />
              <code className="text-[12.5px]">{s.colors?.brand}</code>
            </span>
          </Field>
          <Field label="보조색">
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
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card title="메뉴(섹션)" note={<>메뉴는 <a href="/admin/categories" className="underline underline-offset-2">섹션 메뉴</a>에서 만든 섹션 순서 그대로 나옵니다. “전문 섹션”으로 표시하면 메뉴 오른쪽에 따로 모이고, 첫 화면에 전문 섹션 탭으로 나옵니다.</>}>
        {sections.length ? (
          <ul className="divide-y divide-line rounded border border-line">
            {sections.map((c, i) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13.5px]">
                <span className="w-32 font-semibold">{c.name}</span>
                <label className="flex items-center gap-1.5">
                  <input type="checkbox" checked={!!c.specialty} onChange={(e) => setSections(sections.map((x, j) => (j === i ? { ...x, specialty: e.target.checked } : x)))} />
                  전문 섹션
                </label>
                {c.specialty && (
                  <input value={c.description ?? ''} onChange={(e) => setSections(sections.map((x, j) => (j === i ? { ...x, description: e.target.value } : x)))} placeholder="짧은 설명 (예: 요양병원·요양시설 소식)" maxLength={100} className="field-input min-w-[240px] flex-1 py-1.5" />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-muted">섹션이 없습니다. 섹션 메뉴에서 먼저 만들어 주세요.</p>
        )}
      </Card>

      <Card title="하단 표시 정보" note="인터넷신문은 제호·등록번호·등록일·발행인·편집인·발행소 주소·전화, 청소년보호책임자를 홈페이지에 표시해야 합니다(* 표시).">
        <div className="grid gap-4 sm:grid-cols-3">
          {LEGAL.map((f) => (
            <div key={f.k} className={f.wide ? 'sm:col-span-2' : ''}>
              <Field label={<>{f.label}{f.required && <span className="text-danger"> *</span>}</>}>
                <input value={s.legal?.[f.k] ?? ''} onChange={(e) => setLegal(f.k, e.target.value)} placeholder={f.ph} className="field-input" />
              </Field>
            </div>
          ))}
        </div>
        {missing.length > 0 && <p className="mt-3 rounded bg-draft/10 px-3 py-2 text-[12.5px] text-[#6B5F22]">⚠ 아직 비어 있는 필수 항목: {missing.map((m) => m.label).join(', ')}</p>}
      </Card>

      <Card title="보도자료 추천" note="보도자료함 ‘추천’ 탭에 보여줄 자료를 정합니다. ‘전체’ 탭에는 언제나 모든 자료가 나옵니다.">
        <fieldset className="space-y-1.5 text-[13.5px]">
          <legend className="font-bold">매체 분야</legend>
          <p className="text-[12px] text-muted">고른 분야의 뉴스와이어 분류만 추천에 나옵니다. 정부·공공기관 보도자료는 제목에 아래 키워드가 있을 때만 나옵니다.</p>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {PRESS_FIELDS.map((f) => {
              const now = pressFields(s, keywordList)
              return (
                <label key={f.key} className="flex items-center gap-2">
                  <input type="checkbox" checked={now.includes(f.key)} onChange={(e) => set({ pressFields: now.filter((k) => k !== f.key).concat(e.target.checked ? [f.key] : []) })} />
                  <strong>{f.label}</strong>
                </label>
              )
            })}
          </div>
        </fieldset>
        <div className="mt-4">
          <p className="text-[13.5px] font-bold">추천 키워드</p>
          <p className="mb-1.5 text-[12px] text-muted">제목에 이 단어가 들어간 정부·공공기관 보도자료를 추천에 넣습니다(분야를 고르지 않았다면 모든 출처에서). 쉼표로 구분합니다. 3글자 이하 영문 약어(IB, AI 등)는 다른 단어에 섞여 걸리기 쉬워 쓰지 않습니다.</p>
          <textarea value={s.pressKeywords ?? ''} onChange={(e) => set({ pressKeywords: e.target.value })} rows={3} placeholder="예: 요양, 돌봄, 복지, 병원" className="field-input resize-y" />
        </div>
      </Card>

      <Card title="오픈 준비 중">
        <label className="flex items-start gap-3 text-[14px]">
          <input type="checkbox" checked={!!s.comingSoon} onChange={(e) => set({ comingSoon: e.target.checked })} className="mt-1" />
          <span>
            <strong>오픈 준비 중 (방문자에게는 안내 화면만 보이기)</strong>
            <span className="mt-0.5 block text-[12.5px] text-muted">켜 두면 도메인으로 들어온 방문자에게 “오픈 준비 중입니다” 화면만 보이고, 검색엔진 수집도 막힙니다. 우리와 고객은 아래 “홈페이지 미리보기” 링크로 실제 홈페이지를 볼 수 있습니다. <strong>정식 오픈하는 날 끄세요</strong> (이날이 개통일이고 첫 청구서를 발행하는 날입니다).</span>
          </span>
        </label>
        <p className="mt-3 text-[12.5px]"><a href={previewUrl(outlet.id)} target="_blank" rel="noopener" className="font-semibold text-review underline underline-offset-2">홈페이지 미리보기 ↗</a><span className="ml-2 text-muted">고객에게 보여 줄 때 이 링크를 보내세요.</span></p>
      </Card>

      <Card title="도메인">
        <Field label="홈페이지 주소" hint="www 없이 적습니다. 예: thecaretimes.net">
          <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="예: seniornews.co.kr" className="field-input max-w-sm" />
        </Field>
        <details className="mt-4 rounded bg-[#F8F9FA] px-4 py-3 text-[13px] leading-relaxed">
          <summary className="cursor-pointer font-semibold">도메인 연결하는 방법</summary>
          <ol className="mt-2 list-decimal space-y-1.5 pl-5">
            <li>위 칸에 주소를 적고 저장합니다.</li>
            <li><strong>총관리자</strong>가 Vercel → imcms 프로젝트 → Settings → Domains에서 그 주소와 www 주소를 추가합니다. (업무요청으로 “도메인 연결”을 요청하세요.)</li>
            <li>도메인을 산 곳(후이즈, 호스팅케이알, 가비아 등)의 <strong>DNS 레코드(A·CNAME) 설정</strong>에서, Vercel Domains 화면에 표시된 값을 그대로 넣습니다. 지금은 보통 <code>@</code> A 레코드 <code>216.150.1.1</code>, <code>www</code> CNAME <code>…vercel-dns-017.com</code> 형태입니다. (예전 값 <code>76.76.21.21</code>·<code>cname.vercel-dns.com</code>도 당분간 작동하지만, 화면에 나온 값을 쓰는 것이 가장 확실합니다.)</li>
            <li>이미 <code>@</code>·<code>www</code> 줄이 있으면(예: 도메인 업체 기본 주소) <strong>새로 추가하지 말고 그 줄을 수정</strong>합니다. 같은 호스트에 A와 CNAME이 같이 있으면 안 됩니다.</li>
            <li>후이즈는 “DNS 호스트 관리”(네임서버 등록 메뉴)가 아니라 <strong>네임서버 고급설정 안의 레코드(A·CNAME) 설정</strong>입니다. “DNS 호스트 관리”에 넣으면 연결되지 않습니다.</li>
            <li>보통 몇 분~몇 시간 뒤 주소로 들어가면 이 매체 홈페이지가 열립니다. Vercel Domains 화면에서 Refresh를 눌러 연결 상태를 확인합니다.</li>
          </ol>
        </details>
      </Card>

      <Card title="검색 노출">
        <label className="flex items-start gap-3 text-[14px]">
          <input type="checkbox" checked={!!s.indexable} onChange={(e) => set({ indexable: e.target.checked })} className="mt-1" />
          <span>
            <strong>구글·네이버 검색에 노출하기</strong>
            <span className="mt-0.5 block text-[12.5px] text-muted">정식으로 여는 날 켜세요. 테스트 기사가 남아 있을 때 켜면 검색 결과에 그대로 남을 수 있습니다.</span>
          </span>
        </label>
        <fieldset className="mt-4 space-y-2 rounded-lg border border-line p-3 text-[13.5px]">
          <legend className="px-1 font-bold">AI 크롤러 (ChatGPT·Claude 등 AI 회사의 수집 봇)</legend>
          <p className="text-[12px] text-muted">기사가 AI 학습에 쓰이는 것을 매체가 정합니다. 구글·네이버 검색에는 영향이 없습니다. 규칙을 지키는 회사의 봇만 따르며, 이미 수집된 자료는 지워지지 않습니다. 저장 후 10분쯤 뒤부터 적용됩니다.</p>
          {AI_BOT_MODES.map((m) => (
            <label key={m.key} className="flex items-start gap-2">
              <input type="radio" name="aiBots" checked={(s.aiBots ?? 'allow') === m.key} onChange={() => set({ aiBots: m.key })} className="mt-1" />
              <span><strong>{m.label}</strong><span className="block text-[12px] text-muted">{m.hint}</span></span>
            </label>
          ))}
          <p className="text-[12px] text-muted">확인: 이 매체 주소 뒤에 <code>/robots.txt</code>를 붙여 열면 적용된 규칙이 보입니다. 검색 노출을 켜지 않은 매체는 모든 봇이 이미 막혀 있습니다.</p>
        </fieldset>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="네이버 서치어드바이저 확인 코드" hint="“HTML 태그” 방식의 메타 태그를 통째로 붙여 넣어도 됩니다">
            <input value={s.naverVerification ?? ''} onChange={(e) => set({ naverVerification: e.target.value })} maxLength={300} placeholder='<meta name="naver-site-verification" content="…" />' className="field-input" />
          </Field>
          <Field label="구글 서치콘솔 확인 코드" hint="“HTML 태그” 방식의 메타 태그를 통째로 붙여 넣어도 됩니다">
            <input value={s.googleVerification ?? ''} onChange={(e) => set({ googleVerification: e.target.value })} maxLength={300} placeholder='<meta name="google-site-verification" content="…" />' className="field-input" />
          </Field>
        </div>
        <SearchRegisterGuide outletId={outlet.id} domain={outlet.domain} />
      </Card>

      {/* 하단 미리보기 */}
      <section className="overflow-hidden rounded-lg border border-line bg-white">
        <p className="border-b border-line bg-[#F8F9FA] px-4 py-2 text-[12.5px] font-semibold">하단 미리보기</p>
        <div className="pointer-events-none h-[260px] overflow-hidden" aria-hidden>
          <div className="site origin-top-left scale-[0.62]" style={{ ...vars, width: '161%' }}>
            <SiteFooter site={preview} />
          </div>
        </div>
      </section>

      <div className="cms-actionbar border-t border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[960px] flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 md:px-8 md:py-3">
          <p role={msg.error ? 'alert' : 'status'} className={`min-w-[12rem] flex-1 text-[13px] ${msg.error ? 'font-semibold text-danger' : msg.ok ? 'text-published' : 'text-muted'}`}>
            {msg.error ?? msg.ok ?? '바꾼 내용은 저장해야 홈페이지에 반영됩니다.'}
          </p>
          <a href={previewUrl(outlet.id)} target="_blank" rel="noopener" className="btn-secondary">홈페이지 미리보기</a>
          <button type="button" onClick={save} disabled={pending || uploading} className="btn-publish px-6">{pending ? '저장 중…' : '저장'}</button>
        </div>
      </div>
    </div>
  )
}

// 홈 오른쪽 '숫자 판' 편집 (예: 선교 통계). 숫자마다 출처를 적는다
function StatsEditor({ value, onChange }: { value: OutletSiteSettings['statsBoard']; onChange: (v: OutletSiteSettings['statsBoard']) => void }) {
  const b = value ?? { title: '', items: [] }
  const items = b.items ?? []
  const put = (i: number, patch: Partial<(typeof items)[number]>) => onChange({ ...b, items: items.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
  return (
    <fieldset className="space-y-2 rounded-lg border border-line p-3 text-[13px]">
      <legend className="px-1 text-[13.5px] font-bold">숫자 판 <span className="font-normal text-muted">(홈 오른쪽, 비워 두면 안 나옵니다)</span></legend>
      <input value={b.title ?? ''} onChange={(e) => onChange({ ...b, title: e.target.value })} maxLength={30} placeholder="제목 (예: 숫자로 보는 세계선교)" className="field-input" />
      {items.map((x, i) => (
        <div key={i} className="grid gap-1.5 rounded-md bg-paper/50 p-2 sm:grid-cols-[1fr_120px_1fr]">
          <input value={x.label} onChange={(e) => put(i, { label: e.target.value })} maxLength={40} placeholder="이름 (예: 한국 장기 선교사)" className="field-input" />
          <input value={x.value} onChange={(e) => put(i, { value: e.target.value })} maxLength={30} placeholder="숫자 (예: 21,621명)" className="field-input" />
          <input value={x.note ?? ''} onChange={(e) => put(i, { note: e.target.value })} maxLength={80} placeholder="덧붙임 (예: 171개국)" className="field-input" />
          <input value={x.source ?? ''} onChange={(e) => put(i, { source: e.target.value })} maxLength={80} placeholder="출처 (예: KWMA·KRIM, 2024년 말)" className="field-input sm:col-span-2" />
          <div className="flex gap-1.5">
            <input value={x.url ?? ''} onChange={(e) => put(i, { url: e.target.value })} maxLength={300} placeholder="출처 주소 (선택)" className="field-input min-w-0 flex-1" />
            <button type="button" onClick={() => onChange({ ...b, items: items.filter((_, j) => j !== i) })} className="shrink-0 px-2 text-danger underline">빼기</button>
          </div>
        </div>
      ))}
      {items.length < 8 && <button type="button" onClick={() => onChange({ ...b, items: [...items, { label: '', value: '' }] })} className="btn-secondary">+ 숫자 추가</button>}
      <input value={b.footnote ?? ''} onChange={(e) => onChange({ ...b, footnote: e.target.value })} maxLength={200} placeholder="아래 작은 설명 (선택, 예: 집계 기준이 기관마다 다릅니다)" className="field-input" />
    </fieldset>
  )
}
