// IM 뉴스룸 제품 홈페이지 (CMS를 다른 언론사에 판매하기 위한 소개 사이트)
export const PRODUCT = {
  name: 'IM 뉴스룸',
  nameEn: 'IM Newsroom',
  // 이 주소로 들어오면 첫 화면이 제품 홈페이지가 된다 (imnewsroom.com 은 2026-10 구입, .co.kr 은 사면 연결)
  domains: ['imnewsroom.com', 'www.imnewsroom.com', 'imnewsroom.co.kr', 'www.imnewsroom.co.kr'],
  // 대표 주소 (검색엔진·공유 링크에 쓴다)
  url: 'https://imnewsroom.com',
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
  address: '1608 Hollowhil Dr, Apt 912, Bryan, TX 77802, USA' as string | null,
  contact: null as string | null,
}
