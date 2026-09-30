'use client'

import { useMemo, useRef, useState, useTransition, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { saveSiteSettings } from '@/app/(main)/admin/outlets/[id]/site/actions'
import { buildSite, DEFAULT_COLORS, type CategoryRow, type LogoMode, type OutletSiteSettings, type SiteLegal } from '@/lib/sites'
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
    <section className="rounded-lg border border-line bg-white p-6">
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
        <div className="flex items-center justify-between border-b border-line bg-[#F8F9FA] px-4 py-2 text-[12.5px]">
          <span className="font-semibold">미리보기 <span className="font-normal text-muted">(PC 화면 머리 부분, 저장 전에도 바로 바뀝니다)</span></span>
          <a href={`/?preview_outlet=${outlet.id}`} target="_blank" rel="noopener" className="font-semibold text-review underline underline-offset-2">저장한 홈페이지 전체 보기 ↗</a>
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
          <div className="sm:col-span-2">
            <Field label="매체 소개" hint="검색 결과·공유할 때 나오는 설명 (160자 이내 권장)"><input value={s.description ?? ''} onChange={(e) => set({ description: e.target.value })} maxLength={200} className="field-input" /></Field>
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

      <Card title="보도자료 추천 키워드" note="보도자료함 ‘추천’ 탭에서 제목·요약에 이 단어가 들어간 보도자료만 골라 보여줍니다. 쉼표로 구분합니다.">
        <textarea value={s.pressKeywords ?? ''} onChange={(e) => set({ pressKeywords: e.target.value })} rows={3} placeholder="예: 요양, 돌봄, 복지, 병원" className="field-input resize-y" />
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
            <li>도메인을 산 곳(호스팅케이알, 가비아 등)의 DNS 설정에서 Vercel이 알려주는 값을 넣습니다. 보통 <code>@</code> A 레코드 <code>76.76.21.21</code>, <code>www</code> CNAME <code>cname.vercel-dns.com</code>입니다.</li>
            <li>보통 몇 분~몇 시간 뒤 주소로 들어가면 이 매체 홈페이지가 열립니다.</li>
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

      <div className="fixed bottom-0 right-0 z-20 border-t border-line bg-white/95 backdrop-blur" style={{ left: 76 }}>
        <div className="mx-auto flex max-w-[960px] items-center gap-3 px-8 py-3">
          <p role={msg.error ? 'alert' : 'status'} className={`flex-1 text-[13px] ${msg.error ? 'font-semibold text-danger' : msg.ok ? 'text-published' : 'text-muted'}`}>
            {msg.error ?? msg.ok ?? '바꾼 내용은 저장해야 홈페이지에 반영됩니다.'}
          </p>
          <a href={`/?preview_outlet=${outlet.id}`} target="_blank" rel="noopener" className="btn-secondary">홈페이지 미리보기</a>
          <button type="button" onClick={save} disabled={pending || uploading} className="btn-publish px-6">{pending ? '저장 중…' : '저장'}</button>
        </div>
      </div>
    </div>
  )
}
