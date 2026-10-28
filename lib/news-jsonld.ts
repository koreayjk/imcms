import type { PublicArticle } from './public-data'
import type { SiteConfig } from './sites'
import { reporterHref } from './reporter'

// 마지막 수정 시각: 발행 시각보다 뒤일 때만 따로 적는다
const modified = (a: PublicArticle) => (a.updated_at && a.published_at && Date.parse(a.updated_at) > Date.parse(a.published_at) ? a.updated_at : a.published_at!)

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
    ...(a.published_at ? { datePublished: a.published_at, dateModified: modified(a) } : {}),
    ...(a.author_name ? { author: [{ '@type': 'Person', '@id': `${base}${reporterHref(a.author_name)}#person`, name: a.author_name, url: `${base}${reporterHref(a.author_name)}` }] } : { author: [{ '@type': 'Organization', name: site.name, url: base }] }),
    publisher: { '@type': 'NewsMediaOrganization', name: site.name, url: base, ...(logo ? { logo: { '@type': 'ImageObject', url: logo } } : {}) },
    ...(a.category ? { articleSection: a.category.name } : {}),
    ...(a.tags?.length ? { keywords: a.tags.join(', ') } : {}),
    inLanguage: site.lang === 'en' ? 'en-US' : 'ko-KR',
    isAccessibleForFree: true,
  }
  // </script> 로 끝나는 글자가 기사 안에 있어도 깨지지 않게
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

// 매체 첫 화면 구조화 데이터 (WebSite + NewsMediaOrganization)
//   구글 검색·구글 뉴스가 매체 이름(사이트 이름)과 로고를 이 값으로 정한다
export function siteJsonLd(site: SiteConfig, base: string) {
  const abs = (u: string | null | undefined) => (!u ? undefined : /^https?:\/\//.test(u) ? u : `${base}${u.startsWith('/') ? '' : '/'}${u}`)
  const logo = abs(site.logoMark)
  const data = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': `${base}/#website`,
        url: `${base}/`,
        name: site.name,
        ...(site.nameEn && site.nameEn !== site.name ? { alternateName: site.nameEn } : {}),
        inLanguage: site.lang === 'en' ? 'en-US' : 'ko-KR',
        publisher: { '@id': `${base}/#organization` },
      },
      {
        '@type': 'NewsMediaOrganization',
        '@id': `${base}/#organization`,
        name: site.name,
        ...(site.nameEn && site.nameEn !== site.name ? { alternateName: site.nameEn } : {}),
        url: `${base}/`,
        ...(logo ? { logo: { '@type': 'ImageObject', url: logo } } : {}),
        ...(site.description ? { description: site.description } : {}),
        // 신뢰 정보 페이지 (매체소개·편집원칙·정정 안내): 검색·AI가 이 매체의 운영 원칙을 확인하는 곳
        masthead: `${base}/policy/about`,
        publishingPrinciples: `${base}/policy/editorial`,
        ethicsPolicy: `${base}/policy/editorial`,
        correctionsPolicy: `${base}/policy/corrections`,
        actionableFeedbackPolicy: `${base}/policy/corrections`,
      },
    ],
  }
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

// 기사 경로 (홈 > 섹션 > 기사): 검색·AI가 이 기사가 어느 섹션에 속하는지 읽게 한다
export function articleBreadcrumbJsonLd(site: SiteConfig, a: PublicArticle, base: string) {
  const items = [
    { name: site.name, url: `${base}/` },
    ...(a.category ? [{ name: a.category.name, url: `${base}/section/${a.category.slug}` }] : []),
    { name: a.title.slice(0, 110), url: `${base}/news/${a.id}` },
  ]
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((x, i) => ({ '@type': 'ListItem', position: i + 1, name: x.name, item: x.url })),
  }
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

// 기자 소개 구조화 데이터 (schema.org ProfilePage + Person): 기사의 author 와 같은 @id 로 이어진다
export function reporterJsonLd(site: SiteConfig, base: string, p: { name: string; bio?: string | null; photo?: string | null; email?: string | null }) {
  const abs = (u: string | null | undefined) => (!u ? undefined : /^https?:\/\//.test(u) ? u : `${base}${u.startsWith('/') ? '' : '/'}${u}`)
  const url = `${base}${reporterHref(p.name)}`
  const data = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url,
    mainEntity: {
      '@type': 'Person',
      '@id': `${url}#person`,
      name: p.name,
      url,
      jobTitle: site.lang === 'en' ? 'Reporter' : '기자',
      worksFor: { '@type': 'NewsMediaOrganization', name: site.name, url: `${base}/` },
      ...(p.bio ? { description: p.bio.slice(0, 500) } : {}),
      ...(abs(p.photo) ? { image: abs(p.photo) } : {}),
      ...(p.email ? { email: p.email } : {}),
    },
  }
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
