// IM 뉴스룸 제품 홈페이지 (CMS를 다른 언론사에 판매하기 위한 소개 사이트)
export const PRODUCT = {
  name: 'IM 뉴스룸',
  nameEn: 'IM Newsroom',
  // 도메인을 사면 여기에 넣는다. 이 주소로 들어오면 첫 화면이 제품 홈페이지가 된다
  domains: ['imnewsroom.com', 'www.imnewsroom.com', 'imnewsroom.co.kr', 'www.imnewsroom.co.kr'],
  // 미리보기 주소 (도메인 연결 전에도 imcms.vercel.app/imnewsroom 으로 볼 수 있다)
  path: '/imnewsroom',
  indexable: false,
}

export function isProductHost(host: string | null | undefined) {
  const h = (host ?? '').split(':')[0].toLowerCase()
  return PRODUCT.domains.includes(h)
}
