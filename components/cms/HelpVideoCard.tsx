'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useT } from './CmsLang'

// 이용안내 영상 카드: 처음에는 사진만 보여 주고, 누르면 그 자리에서 유튜브 영상이 열린다 (페이지를 열 때마다 영상을 불러오지 않는다)
export default function HelpVideoCard({ title, desc, videoId, src, poster, link, n, shareId, autoOpen }: { title: string; desc: string; videoId?: string | null; src?: string; poster?: string; link?: { label: string; href: string }; n: number; shareId?: string; autoOpen?: boolean }) {
  const t = useT()
  const [on, setOn] = useState(!!autoOpen)
  const [copied, setCopied] = useState(false)
  // 카드에 보여 줄 주소 머리: 화면을 연 주소를 그대로 쓴다 (서버·브라우저가 같은 값을 쓰도록 처음엔 제품 주소)
  const [shareHost, setShareHost] = useState('app.imnewsroom.com')
  useEffect(() => { setShareHost(window.location.host) }, [])
  // 이 영상만 열리는 주소를 복사한다 (고객에게 보낼 링크)
  const copy = async () => {
    const url = `${window.location.origin}/support/help/${shareId}`
    try { await navigator.clipboard.writeText(url) } catch { window.prompt(t('이 주소를 복사하세요', 'Copy this link'), url); return }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
      <div className="relative aspect-video w-full bg-[#0B1020]">
        {src ? (
          // 회원 전용 영상: 누를 때까지 내려받지 않는다 (preload none + 대표 사진)
          <video src={src} poster={poster} controls preload="none" playsInline controlsList="nodownload" disablePictureInPicture className="absolute inset-0 h-full w-full bg-black object-contain" aria-label={title} />
        ) : on && videoId ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        ) : (
          <button type="button" onClick={() => setOn(true)} aria-label={t(`${title} 영상 재생`, `Play video: ${title}`)} className="group absolute inset-0 block h-full w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={poster ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`} alt="" loading="lazy" className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100" />
            <span className="absolute left-3 top-3 rounded-full bg-black/70 px-2.5 py-0.5 text-[12px] font-bold text-white">{n}</span>
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid h-14 w-14 place-items-center rounded-full bg-white/95 shadow-lg transition group-hover:scale-105">
                <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden><path d="M8 5.5v13l11-6.5-11-6.5Z" fill="#14171C" /></svg>
              </span>
            </span>
          </button>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-[15.5px] font-bold leading-snug">{title}</p>
        <p className="mt-1.5 flex-1 text-[13.5px] leading-relaxed text-[#3B4048]">{desc}</p>
        {link && <Link href={link.href} className="mt-3 w-fit text-[13px] font-semibold text-[#2F6BF0] hover:underline">{t(`${link.label} 화면 열기 →`, `Open ${link.label} →`)}</Link>}
        {shareId && (
          <button type="button" onClick={copy} title={t('누르면 이 영상 링크가 복사됩니다', 'Click to copy this video link')} aria-live="polite"
            className={`mt-3 flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12.5px] transition ${copied ? 'border-published bg-published/10 text-published' : 'border-line bg-[#F6F8FA] text-muted hover:border-ink hover:text-ink'}`}>
            <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden className="shrink-0"><path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
            <span className="min-w-0 flex-1 truncate font-mono">{copied ? t('영상 링크가 복사되었습니다', 'Video link copied') : `${shareHost}/support/help/${shareId}`}</span>
            <span className="shrink-0 font-semibold">{copied ? '✓' : t('복사', 'Copy')}</span>
          </button>
        )}
      </div>
    </div>
  )
}
