import { BRAND_ICONS } from '@/lib/brand'

// IM 뉴스룸 소개·체험 화면: 브라우저 탭에 IM 뉴스룸 로고
export const metadata = { icons: BRAND_ICONS }

export default function Layout({ children }: { children: React.ReactNode }) {
  return children
}
