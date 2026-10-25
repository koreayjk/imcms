import { redirect } from 'next/navigation'

// 광고문의는 광고 메뉴 안(광고문의 탭)으로 옮겼다. 예전 주소·메일 링크는 그리로 넘긴다
export default function InquiriesMoved() {
  redirect('/admin/ads/inquiries')
}
