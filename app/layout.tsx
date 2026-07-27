import './globals.css'

export const metadata = {
  title: 'IM CMS',
  description: '언론사용 기사 관리 시스템',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
