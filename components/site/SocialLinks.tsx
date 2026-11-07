import { SOCIAL_KINDS, type SocialLink } from '@/lib/sites'

// 하단 SNS 링크 줄: 매체 설정(SNS 링크)에 넣은 공식 계정을 동그란 아이콘으로 보여 준다. 새 창으로 열린다
const svg = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const

function Glyph({ kind }: { kind: SocialLink['kind'] }) {
  switch (kind) {
    case 'youtube':
      return <svg {...svg}><rect x="2.5" y="5.5" width="19" height="13" rx="4" /><path d="M10 9.5v5l4.5-2.5z" fill="currentColor" /></svg>
    case 'instagram':
      return <svg {...svg}><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="3.8" /><circle cx="17" cy="7" r="0.6" fill="currentColor" /></svg>
    case 'facebook':
      return <svg {...svg}><path d="M14.5 21v-7.5H17l.5-3h-3V8.8c0-.9.4-1.5 1.6-1.5h1.6V4.6c-.3 0-1.3-.1-2.3-.1-2.4 0-3.9 1.4-3.9 4v2H9v3h2.5V21" /></svg>
    case 'x':
      return <svg {...svg}><path d="M4 4l16 16M20 4L4 20" /></svg>
    default: {
      const ch = { threads: '@', tiktok: '♪', naverblog: 'N', kakao: 'TALK' }[kind]
      return <span aria-hidden className={`font-bold leading-none ${kind === 'kakao' ? 'text-[9px] tracking-tight' : 'text-[14px]'}`}>{ch}</span>
    }
  }
}

export default function SocialLinks({ items, en }: { items: SocialLink[]; en?: boolean }) {
  if (!items.length) return null
  return (
    <ul className="flex flex-wrap items-center gap-2" aria-label={en ? 'Social links' : 'SNS 링크'}>
      {items.map((x) => {
        const k = SOCIAL_KINDS.find((z) => z.key === x.kind)
        const name = k ? (en ? k.en : k.label) : x.kind
        return (
          <li key={x.kind}>
            <a href={x.url} target="_blank" rel="noopener noreferrer" aria-label={name} title={name}
              className="grid h-9 w-9 place-items-center rounded-full border border-rule bg-white text-body transition-colors hover:border-brand hover:bg-brand hover:text-white">
              <Glyph kind={x.kind} />
            </a>
          </li>
        )
      })}
    </ul>
  )
}
