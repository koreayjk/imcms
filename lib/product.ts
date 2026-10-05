// IM 뉴스룸 제품 홈페이지 (CMS를 다른 언론사에 판매하기 위한 소개 사이트)
export const PRODUCT = {
  name: 'IM 뉴스룸',
  nameEn: 'IM Newsroom',
  // 이 주소로 들어오면 첫 화면이 제품 홈페이지가 된다 (imnewsroom.com 은 2026-10 구입, .co.kr 은 사면 연결)
  domains: ['imnewsroom.com', 'www.imnewsroom.com', 'imnewsroom.co.kr', 'www.imnewsroom.co.kr'],
  // 대표 주소 (검색엔진·공유 링크에 쓴다)
  url: 'https://imnewsroom.com',
  // 편집국 주소 (로그인·기사 쓰기·체험 가입). appLive 를 켜면 소개 사이트의 로그인·체험 링크, 메일 속 편집국 링크가
  //   이 주소로 가고 imnewsroom.com 의 편집국 화면은 이 주소로 넘어간다 (로그인은 주소마다 따로라 한 곳으로 모은다)
  appHost: 'app.imnewsroom.com',
  appUrl: 'https://app.imnewsroom.com',
  appLive: true,
  // 카카오톡·SNS 공유 미리보기 그림 (1200×630)
  ogImage: '/imnewsroom/og.png',
  // 미리보기 주소 (도메인 연결 전에도 imcms.vercel.app/imnewsroom 으로 볼 수 있다)
  path: '/imnewsroom',
  // 제품 도메인으로 들어온 경우에만 검색 수집을 허락한다 (imcms.vercel.app/imnewsroom 미리보기는 막는다)
  indexable: true,
}

// 검색엔진에 알릴 제품 홈페이지 주소들
export const PRODUCT_PAGES = ['/', '/trial', '/imnewsroom/terms', '/imnewsroom/privacy']

export function isProductHost(host: string | null | undefined) {
  const h = (host ?? '').split(':')[0].toLowerCase()
  return PRODUCT.domains.includes(h)
}

export function isAppHost(host: string | null | undefined) {
  return (host ?? '').split(':')[0].toLowerCase() === PRODUCT.appHost
}

// 편집국 화면 링크 (appLive 전에는 지금 주소 기준)
export function appLink(path: string) {
  return PRODUCT.appLive ? `${PRODUCT.appUrl}${path}` : path
}

// 편집국에서 여는 매체 홈페이지 주소: 도메인이 있으면 그 주소, 없으면 미리보기
//   (편집국 주소 app.imnewsroom.com 의 첫 화면은 편집국이라, 미리보기는 imcms.vercel.app 에서 연다)
export function outletHomeUrl(o: { id: string; domain?: string | null } | null | undefined, path = '/') {
  if (!o) return path
  if (o.domain) return `https://${o.domain}${path}`
  return `${PRODUCT.appLive ? 'https://imcms.vercel.app' : ''}${path}?preview_outlet=${o.id}`
}

// 소개 사이트(imnewsroom.com)에서 편집국 주소로 넘길 경로
export const APP_PATHS = ['/login', '/signup', '/trial', '/pending', '/newsroom', '/articles', '/press', '/admin', '/support', '/account']

// 청구서의 공급자(운영사) 정보 — 미국 법인 IM America Group Corp 의 상호(DBA) IM Genesis 가 IM 뉴스룸을 운영한다
//   주소는 청구서(그 고객사만 볼 수 있음)에만 나온다
export const ISSUER = {
  // 청구서 “공급자 상호”
  company: 'IM Genesis (IM America Group Corp)' as string | null,
  // 계약 상대방 (이용약관의 “회사”)
  legalName: 'IM America Group Corp' as string | null,
  dba: 'IM Genesis' as string | null,
  bizNo: null as string | null,
  ceo: 'Sang W Lee' as string | null,
  address: '1608 Hollowhill Dr, Apt 912, Bryan, TX 77802, USA' as string | null,
  contact: null as string | null,
}
