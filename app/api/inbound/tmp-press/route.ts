// 임시: 막힌 출처가 Vercel(서울)에서 읽히는지 시험하는 길 (시험한 뒤 바로 지운다). 시험 대상은 고정이고 아무것도 저장하지 않는다
import { collectSource } from '@/lib/press'
import { PRESS_SOURCES } from '@/lib/press-sources'
export const runtime = 'nodejs'
export const preferredRegion = 'icn1'
export const maxDuration = 60
export async function GET() {
  const by = (k: string) => PRESS_SOURCES.find((s) => s.key === k)!
  const cases = [
    { label: 'ganghwa-new', s: { ...by('lg-ganghwa'), url: 'https://www.ganghwa.go.kr/open_content/main/bbs/bbsMsgList.do?bcd=report' } },
    { label: 'fda-current', s: by('us-fda') },
    { label: 'fda-alt-newsroom', s: { ...by('us-fda'), url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/fda-newsroom/rss.xml' } },
    { label: 'bcslibrary', s: by('us-bcslibrary') },
    { label: 'omf', s: by('ms-omf') },
    { label: 'toi', s: by('il-toi') },
    { label: 'hayom', s: by('il-hayom') },
    { label: 'jongno', s: by('lg-jongno') },
    { label: 'jungnang', s: by('lg-jungnang') },
    { label: 'gwangsan', s: by('lg-gwangsan') },
  ]
  const out = await Promise.all(cases.map(async (c) => {
    const t = Date.now()
    const r = await collectSource(c.s)
    return { label: c.label, ok: r.ok, message: r.message, rows: r.rows.length, first: r.rows[0]?.title?.slice(0, 50) ?? null, ms: Date.now() - t }
  }))
  return Response.json(out)
}
