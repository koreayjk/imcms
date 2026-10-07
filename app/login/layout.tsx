import type { Viewport } from 'next'

// 로그인·2단계 인증: 입력칸을 누를 때 아이폰이 화면을 확대한 채로 편집국에 들어가지 않게 한다
export const viewport: Viewport = { width: 'device-width', initialScale: 1, maximumScale: 1, viewportFit: 'cover' }

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children
}
