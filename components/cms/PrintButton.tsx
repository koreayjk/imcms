'use client'

export default function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="btn-secondary bg-white">⬇ PDF 저장 · 인쇄</button>
}
