import type { PublicArticle } from './public-data'
import type { SiteConfig } from './sites'

// 기사 구조화 데이터 (schema.org NewsArticle): 구글이 제목·발행 시각·기자·사진·언론사를 정확히 읽게 한다
//   구글 뉴스 탭·“주요 뉴스”에 뽑힐 때 쓰인다. 화면에는 보이지 않는다
export function newsArticleJsonLd(site: SiteConfig, a: PublicArticle, base: string, url: string) {
  const abs = (u: string | null | undefined) => (!u ? undefined : /^https?:\/\//.test(u) ? u : `${base}${u.startsWith('/') ? '' : '/'}${u}`)
  const image = abs(a.thumbnail_url) ?? abs(site.ogImage)
  const logo = abs(site.logoMark) ?? abs(site.ogImage)
  const data = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    url,
    headline: a.title.slice(0, 110),
    ...(a.meta_description || a.excerpt ? { description: (a.meta_description || a.excerpt)!.slice(0, 300) } : {}),
    ...(image ? { image: [image] } : {}),
    ...(a.published_at ? { datePublished: a.published_at, dateModified: a.published_at } : {}),
    ...(a.author_name ? { author: [{ '@type': 'Person', name: a.author_name }] } : { author: [{ '@type': 'Organization', name: site.name, url: base }] }),
    publisher: { '@type': 'NewsMediaOrganization', name: site.name, url: base, ...(logo ? { logo: { '@type': 'ImageObject', url: logo } } : {}) },
    ...(a.category ? { articleSection: a.category.name } : {}),
    ...(a.tags?.length ? { keywords: a.tags.join(', ') } : {}),
    inLanguage: 'ko-KR',
    isAccessibleForFree: true,
  }
  // </script> 로 끝나는 글자가 기사 안에 있어도 깨지지 않게
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
