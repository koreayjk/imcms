'use client'

// 화면의 문서(A4)를 PDF 파일로 만든다 (브라우저에서). 한글 글꼴도 화면 그대로 나온다
//   다운로드와 메일 첨부에 같이 쓴다. 긴 문서는 A4 여러 장으로 나눈다
export async function elementToPdf(el: HTMLElement): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')])
  const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false })
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  const pageW = 210
  const pageH = 297
  const imgH = (canvas.height * pageW) / canvas.width
  if (imgH <= pageH + 0.5) {
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, pageW, imgH)
  } else {
    // A4 높이만큼 잘라 여러 장으로
    const sliceH = Math.floor((canvas.width * pageH) / pageW)
    for (let y = 0, page = 0; y < canvas.height; y += sliceH, page++) {
      const part = document.createElement('canvas')
      part.width = canvas.width
      part.height = Math.min(sliceH, canvas.height - y)
      part.getContext('2d')!.drawImage(canvas, 0, y, canvas.width, part.height, 0, 0, canvas.width, part.height)
      if (page) pdf.addPage()
      pdf.addImage(part.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, pageW, (part.height * pageW) / canvas.width)
    }
  }
  return pdf.output('blob')
}

export function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let s = ''
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(s)
}
