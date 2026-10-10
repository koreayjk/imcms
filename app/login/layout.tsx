import type { Viewport } from 'next'
import { APP_METADATA } from '@/lib/brand'

// 로그인·2단계 인증: 입력칸을 누를 때 아이폰이 화면을 확대한 채로 편집국에 들어가지 않게 한다
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, viewportFit: 'cover', themeColor: '#1D3461' }
export const metadata = APP_METADATA

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
