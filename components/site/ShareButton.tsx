'use client'

import { useEffect, useState, type ReactNode } from 'react'
import type { SiteLang } from '@/lib/sites'

// 기사 공유: 페이스북·X·카카오톡·링크 복사·인쇄 (동그란 아이콘 버튼)
//   카카오톡은 카카오 앱 키 없이 쓸 수 있는 방법이 없어서, 폰에서는 기기 공유창(카카오톡 포함)을 열고 PC에서는 링크를 복사한다
//   미리보기(사진·제목)는 기사 페이지의 og 메타가 만든다
// 카카오 JavaScript 키 (공개 값이다. Vercel 환경변수 NEXT_PUBLIC_KAKAO_JS_KEY). 없거나 불러오지 못하면 폰은 기기 공유창, PC는 링크 복사로 대신한다
const KAKAO_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? ''
// 카카오 앱에 도메인을 등록해 둔 매체 주소만 쉼표로 (NEXT_PUBLIC_KAKAO_DOMAINS 예: newstoday.ai.kr,thecaretimes.net). 등록 안 된 주소에서 SDK를 쓰면 4019 오류 창이 뜨므로 거기서는 기존 방식(폰 공유창·링크 복사)을 쓴다
const KAKAO_DOMAINS = (process.env.NEXT_PUBLIC_KAKAO_DOMAINS ?? '').split(',').map((d) => d.trim().toLowerCase().replace(/^www\./, '')).filter(Boolean)
const KAKAO_SDK = 'https://t1.kakaocdn.net/kakao_js_sdk/2.8.4/kakao.min.js'
const KAKAO_SDK_SRI = 'sha384-BGX7Wb16GmRFagri4bLJV2DgipVZaU2AI812GZtHtHzzDQJnfHasDXN5houxv45w'

type KakaoSdk = { isInitialized(): boolean; init(key: string): void; Share: { sendDefault(o: unknown): void } }
declare global { interface Window { Kakao?: KakaoSdk } }

function loadKakao(): Promise<KakaoSdk> {
  return new Promise((resolve, reject) => {
    const ready = () => {
      const k = window.Kakao
      if (!k) return reject(new Error('kakao'))
      if (!k.isInitialized()) k.init(KAKAO_KEY)
      resolve(k)
    }
    if (window.Kakao) return ready()
    const el = document.createElement('script')
    el.src = KAKAO_SDK
    el.integrity = KAKAO_SDK_SRI
    el.crossOrigin = 'anonymous'
    el.async = true
    el.onload = ready
    el.onerror = () => reject(new Error('kakao'))
    document.head.appendChild(el)
  })
}

const meta = (name: string) => document.querySelector<HTMLMetaElement>(`meta[property="${name}"], meta[name="${name}"]`)?.content ?? ''

const ICONS: Record<string, ReactNode> = {
  facebook: <path d="M13.5 21v-7.6h2.6l.4-3h-3V8.5c0-.9.3-1.5 1.6-1.5h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H8v3h2.5V21h3Z" fill="currentColor" />,
  x: <path d="M17.8 4h2.9l-6.3 7.2L21.8 20h-5.8l-4.5-5.9L6.3 20H3.4l6.7-7.7L2.9 4h5.9l4.1 5.4L17.8 4Zm-1 14.3h1.6L7.9 5.6H6.2l10.6 12.7Z" fill="currentColor" />,
  kakao: <path d="M12 4C7.6 4 4 6.8 4 10.3c0 2.2 1.4 4.2 3.6 5.3l-.9 3.3c-.1.3.2.5.5.4l3.9-2.6c.3 0 .6.1.9.1 4.4 0 8-2.8 8-6.5C20 6.8 16.4 4 12 4Z" fill="currentColor" />,
  link: <path d="M10.6 13.4a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-.9.9M13.4 10.6a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l.9-.9" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  print: <path d="M7 8V4h10v4M7 17H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-2M7 14h10v6H7v-6Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
}

export default function ShareButton({ title, lang, size = 'md' }: { title: string; lang?: SiteLang; size?: 'sm' | 'md' }) {
  const en = lang === 'en'
  const [msg, setMsg] = useState('')
  const [canShare, setCanShare] = useState(false)
  const [mobile, setMobile] = useState(false)
  useEffect(() => {
    setCanShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
    setMobile(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent))
  }, [])

  // 쿼리(미리보기·추적 값)를 뺀 기사 주소
  const url = () => `${window.location.origin}${window.location.pathname}`
  const say = (m: string) => { setMsg(m); window.setTimeout(() => setMsg(''), 3500) }
  const copy = async (after?: string) => {
    try { await navigator.clipboard.writeText(url()); say(after ?? (en ? 'Link copied.' : '링크가 복사되었습니다.')) } catch { say(en ? 'Could not copy the link.' : '링크를 복사하지 못했습니다.') }
  }
  const open = (href: string) => window.open(href, '_blank', 'noopener,noreferrer,width=640,height=560')
  const kakaoFallback = () => (mobile && canShare
    ? navigator.share({ title, url: url() }).catch(() => {})
    : copy(en ? 'Link copied. Paste it into KakaoTalk.' : '링크를 복사했습니다. 카카오톡에 붙여 넣어 보내세요.'))
  const kakao = async () => {
    if (!KAKAO_KEY || !KAKAO_DOMAINS.includes(window.location.hostname.toLowerCase().replace(/^www\./, ''))) return kakaoFallback()
    try {
      const k = await loadKakao()
      const link = { mobileWebUrl: url(), webUrl: url() }
      const image = meta('og:image')
      k.Share.sendDefault({
        objectType: 'feed',
        content: { title, description: (meta('og:description') || '').slice(0, 100), ...(image ? { imageUrl: image } : {}), link },
        buttons: [{ title: en ? 'Read the story' : '기사 보기', link }],
      })
    } catch {
      kakaoFallback()
    }
  }

  const dim = size === 'sm' ? 'h-8 w-8' : 'h-11 w-11'
  const icon = size === 'sm' ? 'h-[18px] w-[18px]' : 'h-6 w-6'
  const buttons: { key: string; label: string; bg: string; fg: string; onClick: () => void }[] = [
    { key: 'facebook', label: en ? 'Share on Facebook' : '페이스북 공유', bg: '#34569B', fg: '#fff', onClick: () => open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url())}`) },
    { key: 'x', label: en ? 'Share on X' : 'X 공유', bg: '#0F7FAE', fg: '#fff', onClick: () => open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url())}&text=${encodeURIComponent(title)}`) },
    { key: 'kakao', label: en ? 'Share on KakaoTalk' : '카카오톡 공유', bg: '#FEE500', fg: '#3B1E1E', onClick: kakao },
    { key: 'link', label: en ? 'Copy link' : '링크 복사', bg: '#00B5C0', fg: '#fff', onClick: () => copy() },
    { key: 'print', label: en ? 'Print' : '인쇄', bg: '#6E6E6E', fg: '#fff', onClick: () => window.print() },
  ]

  return (
    <div className="flex flex-col items-center gap-2 print:hidden">
      <div className="flex items-center gap-2.5">
        {buttons.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={b.onClick}
            aria-label={b.label}
            title={b.label}
            style={{ backgroundColor: b.bg, color: b.fg }}
            className={`${dim} grid place-items-center rounded-full transition-opacity hover:opacity-85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`}
          >
            <svg viewBox="0 0 24 24" className={icon} aria-hidden>{ICONS[b.key]}</svg>
          </button>
        ))}
      </div>
      <span role="status" aria-live="polite" className="min-h-[1.1em] text-[12px] text-brand">{msg}</span>
    </div>
  )
}
