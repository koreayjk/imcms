import type { Viewport } from 'next'
import { APP_METADATA } from '@/lib/brand'
import AppServiceWorker from '@/components/AppServiceWorker'
import { CmsLangProvider } from '@/components/cms/CmsLang'
import { getPublicLang } from '@/lib/cms-t-public'

// 로그인·2단계 인증: 입력칸을 누를 때 아이폰이 화면을 확대한 채로 편집국에 들어가지 않게 한다
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, viewportFit: 'cover', themeColor: '#1D3461' }
export const metadata = APP_METADATA

// 언어(쿠키 im_lang → 브라우저 언어 → 한국어)를 아래 화면(클라이언트 컴포넌트)에 전해 준다
export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const lang = await getPublicLang()
  return <><AppServiceWorker /><CmsLangProvider lang={lang}>{children}</CmsLangProvider></>
}
