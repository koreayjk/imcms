'use client'

// 인쇄 창 열기 (인쇄 창에서 ‘PDF로 저장’을 고르면 PDF 파일로 받는다)
export default function PrintButton({ label = '⬇ PDF 다운 · 인쇄' }: { label?: string }) {
  return <button type="button" onClick={() => window.print()} className="btn-secondary bg-white">{label}</button>
}
