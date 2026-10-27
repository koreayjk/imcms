import { BRAND_ICONS } from '@/lib/brand'
import { CmsLangProvider } from '@/components/cms/CmsLang'
import { getPublicLang } from '@/lib/cms-t-public'

// IM 뉴스룸 소개·체험 화면: 브라우저 탭에 IM 뉴스룸 로고
export const metadata = { icons: BRAND_ICONS }

// 로그인 전 화면 언어를 아래 클라이언트 컴포넌트에 전해 준다
export default async function Layout({ children }: { children: React.ReactNode }) {
  const lang = await getPublicLang()
  return <CmsLangProvider lang={lang}>{children}</CmsLangProvider>
}
