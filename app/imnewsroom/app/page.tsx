import type { Metadata } from 'next'
import BrandMark from '@/components/BrandMark'
import { PRODUCT } from '@/lib/product'
import { PLAY_STORE_URL } from '@/lib/android'

// 앱 받기 (imnewsroom.com/app): 카톡·문자로 보내는 앱 주소
//   플레이 스토어 주소는 미리보기 정보가 화면 1MB 뒤에 있어 카톡이 못 읽는다 → 가벼운 이 화면을 대신 보낸다
const title = `${PRODUCT.name} 앱 — Google Play에서 받기`
const description = '기사 쓰기·승인·발행을 휴대폰에서. IM 뉴스룸 편집국 안드로이드 앱입니다.'

export const metadata: Metadata = {
  title,
  description,
  openGraph: { type: 'website', siteName: PRODUCT.name, title, description, locale: 'ko_KR', url: `${PRODUCT.url}/app`, images: [{ url: PRODUCT.ogImage, width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image', title, description, images: [PRODUCT.ogImage] },
  alternates: { canonical: `${PRODUCT.url}/app` },
}

export default function AppDownloadPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F7F8FA] px-4 py-12 text-[#0F1115]">
      <div className="w-full max-w-sm rounded-2xl border border-[#DADFE8] bg-white p-8 text-center">
        <BrandMark size={72} className="mx-auto rounded-2xl" />
        <h1 className="mt-5 text-[24px] font-extrabold tracking-tight">{PRODUCT.name} 앱</h1>
        <p className="mt-2 text-[14.5px] leading-[1.7] text-[#5B616B]">기사 쓰기·승인·발행을 휴대폰에서.<br />IM 뉴스룸 편집국 안드로이드 앱입니다.</p>

        <a href={PLAY_STORE_URL} className="mt-7 flex items-center justify-center gap-2.5 rounded-xl bg-[#0F1115] px-5 py-3.5 text-white hover:bg-[#262A33]">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path fill="currentColor" d="M4.2 2.4c-.3.3-.4.7-.4 1.2v16.8c0 .5.1.9.4 1.2l9.4-9.6-9.4-9.6Zm10.6 8.4 2.6-2.7L6 1.6c-.4-.2-.8-.3-1.1-.2l9.9 9.4Zm0 2.4-9.9 9.4c.3.1.7 0 1.1-.2l11.4-6.5-2.6-2.7Zm3.9-4.4-3 3.2 3 3.2 3.2-1.8c.9-.5.9-1.9 0-2.4l-3.2-2.2Z" /></svg>
          <span className="text-left leading-tight">
            <span className="block text-[11px] text-white/75">다운로드하기</span>
            <span className="block text-[17px] font-bold">Google Play</span>
          </span>
        </a>

        <p className="mt-6 text-[13px] leading-[1.7] text-[#5B616B]">
          아이폰·PC는 앱 없이 <a href={PRODUCT.appUrl} className="font-semibold text-[#1D3461] underline underline-offset-2">{PRODUCT.appUrl.replace('https://', '')}</a> 에서 바로 쓰시면 됩니다.
        </p>
        <p className="mt-4 text-[12.5px] text-[#8A909A]">
          <a href={PRODUCT.url} className="hover:underline">{PRODUCT.name} 소개 보기</a>
        </p>
      </div>
    </main>
  )
}
