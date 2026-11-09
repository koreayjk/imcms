import { SOCIAL_KINDS, type SocialLink } from '@/lib/sites'

// SNS 링크 줄: 매체 설정(SNS 링크)에 넣은 공식 계정을 각 서비스 색의 둥근 네모 아이콘으로 보여 준다. 새 창으로 열린다
//   size: 'sm' = 머리글·모바일 메뉴(26px), 'md' = 하단(30px). labels = 아이콘 옆에 이름도 써 준다 (1~2개만 넣었을 때 눈에 띄게)
const svg = { viewBox: '0 0 24 24', fill: 'none', stroke: '#fff', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const
const text = (ch: string, small = false) => <span aria-hidden className={`font-bold leading-none text-white ${small ? 'text-[8px] tracking-tight' : 'text-[13px]'}`}>{ch}</span>

const BRAND: Record<SocialLink['kind'], { bg: string; glyph: React.ReactNode }> = {
  youtube: { bg: '#FF0000', glyph: <svg {...svg} fill="#fff" stroke="none"><path d="M9.5 6.8v10.4l8.7-5.2z" /></svg> },
  instagram: {
    bg: 'linear-gradient(45deg,#FEDA75 0%,#FA7E1E 28%,#D62976 55%,#962FBF 78%,#4F5BD5 100%)',
    glyph: <svg {...svg}><rect x="4.5" y="4.5" width="15" height="15" rx="4.5" /><circle cx="12" cy="12" r="3.4" /><circle cx="16.6" cy="7.4" r="0.5" fill="#fff" /></svg>,
  },
  facebook: { bg: '#1877F2', glyph: <svg {...svg} fill="#fff" stroke="none"><path d="M13.4 21v-7.6h2.6l.4-3h-3V8.5c0-.9.3-1.4 1.5-1.4h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.2H8v3h2.4V21z" /></svg> },
  x: { bg: '#000', glyph: <svg {...svg}><path d="M5.5 5.5l13 13M18.5 5.5l-13 13" /></svg> },
  threads: { bg: '#000', glyph: text('@') },
  tiktok: { bg: '#000', glyph: text('♪') },
  naverblog: { bg: '#03C75A', glyph: text('N') },
  kakao: { bg: '#FEE500', glyph: <svg {...svg} fill="#3C1E1E" stroke="none"><path d="M12 5C7.6 5 4 7.7 4 11.1c0 2.2 1.5 4.1 3.7 5.2l-.8 2.9c-.1.3.2.5.5.3l3.4-2.2c.4 0 .8.1 1.2.1 4.4 0 8-2.7 8-6.1S16.4 5 12 5z" /></svg> },
}

export default function SocialLinks({ items, en, size = 'md', labels = false }: { items: SocialLink[]; en?: boolean; size?: 'sm' | 'md'; labels?: boolean }) {
  if (!items.length) return null
  const box = size === 'sm' ? 26 : 30
  return (
    <ul className={`flex flex-wrap items-center ${labels ? 'gap-x-4 gap-y-1' : 'gap-1.5'}`} aria-label={en ? 'Social links' : 'SNS 링크'}>
      {items.map((x) => {
        const k = SOCIAL_KINDS.find((z) => z.key === x.kind)
        const name = k ? (en ? k.en : k.label) : x.kind
        const b = BRAND[x.kind]
        return (
          <li key={x.kind}>
            <a href={x.url} target="_blank" rel="noopener noreferrer" aria-label={name} title={name}
              className={`${labels ? 'inline-flex items-center gap-1.5' : 'grid place-items-center'} transition-opacity hover:opacity-80`}
              style={labels ? undefined : { width: box, height: box, background: b.bg, borderRadius: 5 }}>
              <span className="grid place-items-center" style={labels ? { width: box, height: box, background: b.bg, borderRadius: 5 } : { width: box * 0.8, height: box * 0.8 }}>
                <span className="grid place-items-center" style={labels ? { width: box * 0.8, height: box * 0.8 } : undefined}>{b.glyph}</span>
              </span>
              {labels && <span className="text-[13px] font-bold text-body">{name}</span>}
            </a>
          </li>
        )
      })}
    </ul>
  )
}
