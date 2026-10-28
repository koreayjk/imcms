import { headers } from 'next/headers'
import { currentSite, getHomeData, siteBaseUrl } from '@/lib/public-data'
import { topSections } from '@/lib/sites'
import { reporterHref } from '@/lib/reporter'
import { POLICIES } from '@/lib/policies'
import { isAppHost, isProductHost } from '@/lib/product'

export const dynamic = 'force-dynamic'

// 매체별 llms.txt (llmstxt.org): ChatGPT·Claude·Perplexity 같은 AI가 이 매체가 무엇이고 어디에 무엇이 있는지 한 번에 읽는 안내 파일
//   검색 노출을 켠 매체만 내보낸다. AI 봇을 모두 막은 매체(aiBots = block)·오픈 준비 중인 매체는 내보내지 않는다
const one = (v: string | null | undefined, n: number) => (v ?? '').replace(/\s+/g, ' ').trim().slice(0, n)
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '')

export async function GET() {
  const host = ((await headers()).get('host') ?? '').split(':')[0].toLowerCase()
  const notFound = () => new Response('Not found', { status: 404 })
  if (isAppHost(host) || isProductHost(host)) return notFound()
  const site = await currentSite()
  if (!site.indexable || site.preview || site.comingSoon || site.aiBots === 'block' || !site.domains.includes(host)) return notFound()
  const base = siteBaseUrl(site, host)
  const en = site.lang === 'en'
  const l = site.legal
  const { latest } = await getHomeData(site)
  const recent = latest.slice(0, 30)

  const lines: string[] = []
  lines.push(`# ${site.name}${site.nameEn && site.nameEn !== site.name ? ` (${site.nameEn})` : ''}`, '')
  lines.push(`> ${one(site.description, 300) || (en ? `${site.name} is an online newspaper.` : `${site.name}은(는) 인터넷신문입니다.`)}`, '')

  const facts: string[] = []
  facts.push(en ? `Language: English` : `언어: 한국어`)
  facts.push(`${en ? 'Website' : '홈페이지'}: ${base}/`)
  if (l.publisher) facts.push(`${en ? 'Publisher' : '발행인'}: ${l.publisher}`)
  if (l.editor) facts.push(`${en ? 'Editor' : '편집인'}: ${l.editor}`)
  if (l.company) facts.push(`${en ? 'Company' : '운영사'}: ${l.company}`)
  if (l.registrationNo) facts.push(`${en ? 'Registration' : '등록번호'}: ${l.registrationNo}${l.registeredAt ? ` (${l.registeredAt})` : ''}`)
  if (l.address) facts.push(`${en ? 'Address' : '주소'}: ${one(l.address, 160)}`)
  if (l.email) facts.push(`${en ? 'Contact email' : '대표 이메일'}: ${l.email}`)
  if (l.phone) facts.push(`${en ? 'Phone' : '대표 전화'}: ${l.phone}`)
  lines.push(...facts.map((f) => `- ${f}`), '')

  const sections = topSections(site)
  if (sections.length) {
    lines.push(en ? '## Sections' : '## 섹션', '')
    for (const s of sections) lines.push(`- [${s.name}](${base}/section/${s.slug})${s.description ? `: ${one(s.description, 120)}` : ''}`)
    lines.push('')
  }

  if (recent.length) {
    lines.push(en ? '## Latest stories' : '## 최신 기사', '')
    for (const a of recent) {
      const meta = [day(a.published_at), a.author_name, a.category?.name].filter(Boolean).join(' · ')
      lines.push(`- [${one(a.title, 140)}](${base}/news/${a.id})${a.excerpt ? `: ${one(a.excerpt, 140)}` : ''}${meta ? ` (${meta})` : ''}`)
    }
    lines.push('')
  }

  const authors = [...new Set(recent.map((a) => a.author_name).filter((n): n is string => !!n))].slice(0, 12)
  if (authors.length) {
    lines.push(en ? '## Reporters' : '## 기자', '')
    for (const n of authors) lines.push(`- [${n}](${base}${reporterHref(n)})`)
    lines.push('')
  }

  lines.push(en ? '## Policies' : '## 편집·이용 정책', '')
  for (const p of POLICIES) lines.push(`- [${en ? p.titleEn : p.title}](${base}/policy/${p.slug})`)
  lines.push('')

  lines.push(en ? '## Feeds and sitemaps' : '## 피드·사이트맵', '')
  lines.push(`- [RSS](${base}/rss.xml)`, `- [Sitemap](${base}/sitemap.xml)`, `- [News sitemap](${base}/news-sitemap.xml)`, '')

  lines.push(en ? '## How to cite' : '## 인용 안내', '')
  lines.push(en
    ? `- When citing a story, please include the headline, the reporter's name, "${site.name}", the publication date and the story URL.`
    : `- 기사를 인용할 때는 기사 제목, 기자 이름, 매체 이름(${site.name}), 발행일과 기사 주소를 함께 적어 주세요.`)
  lines.push(en
    ? '- Story pages show the publication time and, when a story was revised later, the update time.'
    : '- 기사 화면에는 발행 시각이 있고, 나중에 고친 기사는 수정 시각이 함께 표시됩니다.')
  if (site.aiNotice?.on) lines.push(en ? '- Stories written with the help of AI carry a disclosure at the end of the story.' : '- AI를 활용해 작성한 기사에는 기사 끝에 활용 사실을 표시합니다.')
  lines.push('')

  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'public, s-maxage=600' } })
}
