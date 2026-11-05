// 메일 보도자료 섹션 분류 설정 (supabase/press-mail-sections.sql)
export type MailSection = { name: string; keywords: string[]; limit: number }
export type MailSectionConf = { sections: MailSection[]; otherLimit: number }
export const MAIL_SECTION_DEFAULT_LIMIT = 5

export function cleanMailSections(v: unknown): MailSectionConf {
  const o = (v ?? {}) as { sections?: unknown; otherLimit?: unknown }
  const lim = (x: unknown) => { const n = Math.round(Number(x)); return Number.isFinite(n) && n >= 0 ? Math.min(n, 100) : MAIL_SECTION_DEFAULT_LIMIT }
  const seen = new Set<string>()
  const sections = (Array.isArray(o.sections) ? o.sections : []).map((x) => {
    const r = (x ?? {}) as { name?: unknown; keywords?: unknown; limit?: unknown }
    const name = String(r.name ?? '').replace(/[<>"]/g, '').trim().slice(0, 30)
    const keywords = [...new Set((Array.isArray(r.keywords) ? r.keywords : []).map((k) => String(k ?? '').replace(/[<>"]/g, '').trim().slice(0, 30)).filter(Boolean))].slice(0, 20)
    return { name, keywords, limit: lim(r.limit) }
  }).filter((s) => s.name && s.name !== '미분류' && !seen.has(s.name) && (seen.add(s.name), true)).slice(0, 30)
  return { sections, otherLimit: lim(o.otherLimit) }
}

