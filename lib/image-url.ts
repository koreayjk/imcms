// 기사 사진을 화면 크기에 맞게 줄여 보낸다 (Vercel 이미지 최적화: WebP 변환 + 캐시)
//   우리 사진 저장소(Supabase media)에 있는 사진만 줄이고, 다른 곳 사진·움직이는 GIF는 그대로 쓴다
//   독자가 사진을 볼 때마다 Supabase 전송량이 쌓이지 않고, 줄인 사진은 Vercel이 캐시해 둔다
const SUPA = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '') ?? ''
const PUBLIC_MEDIA = SUPA ? `${SUPA}/storage/v1/object/public/` : ''

// next.config.js images.deviceSizes / imageSizes 에 있는 너비만 쓸 수 있다
export const IMAGE_WIDTHS = [384, 640, 828, 1200] as const

export function canOptimize(src: string | null | undefined): src is string {
  return !!src && !!PUBLIC_MEDIA && src.startsWith(PUBLIC_MEDIA) && !/\.gif(\?|$)/i.test(src)
}

export function optimizedSrc(src: string, width: number, quality = 75) {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality}`
}

export function optimizedSrcSet(src: string) {
  return IMAGE_WIDTHS.map((w) => `${optimizedSrc(src, w)} ${w}w`).join(', ')
}

// 기사 본문 HTML 안의 사진도 줄인다 (본문 폭 기준 최대 1200px). 원본 주소는 data-src 로 남긴다
export function optimizeBodyImages(html: string) {
  if (!PUBLIC_MEDIA) return html
  return html.replace(/<img\b([^>]*?)\ssrc="([^"]+)"([^>]*)>/gi, (m, pre: string, src: string, post: string) => {
    const raw = src.replace(/&amp;/g, '&')
    if (!canOptimize(raw) || /\ssrcset=/i.test(pre + post)) return m
    // HTML 속성 안이라 & 는 &amp; 로 적는다. 줄인 사진을 못 받으면 원본(data-src)으로 바꾼다
    const at = (w: number) => optimizedSrc(raw, w).replace(/&/g, '&amp;')
    return `<img${pre} src="${at(1200)}" srcset="${at(640)} 640w, ${at(1200)} 1200w" sizes="(max-width: 768px) 100vw, 760px" data-src="${src}" onerror="this.onerror=null;this.removeAttribute('srcset');this.src=this.dataset.src"${post}>`
  })
}
