const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true }

export const SearchIcon = () => (
  <svg {...base}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
)
export const MenuIcon = () => (
  <svg {...base}><path d="M4 6.5h16M4 12h16M4 17.5h16" /></svg>
)
export const CloseIcon = () => (
  <svg {...base}><path d="M6 6l12 12M18 6 6 18" /></svg>
)
export const UserIcon = () => (
  <svg {...base}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
)

// 전체 메뉴 바로가기 타일용 (색이 채워진 굵은 아이콘)
const tile = { width: 30, height: 30, viewBox: '0 0 24 24', 'aria-hidden': true }

export const ClockTile = () => (
  <svg {...tile} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5.5l-3 2" /></svg>
)
export const ChartTile = () => (
  <svg {...tile} fill="currentColor"><rect x="3" y="11" width="4.5" height="10" rx="1" /><rect x="9.75" y="4" width="4.5" height="17" rx="1" /><rect x="16.5" y="14" width="4.5" height="7" rx="1" /></svg>
)
export const CrownTile = () => (
  <svg {...tile} fill="currentColor"><path d="M3 7l4.5 4L12 4l4.5 7L21 7l-1.8 11H4.8L3 7Z" /><rect x="4.8" y="19.2" width="14.4" height="2.2" rx="1" /></svg>
)
export const PenTile = () => (
  <svg {...tile} fill="currentColor"><path d="M4 16.8V20h3.2L18 9.2 14.8 6 4 16.8Z" /><path d="M16.2 4.6l3.2 3.2 1.1-1.1a1.5 1.5 0 0 0 0-2.1l-1.1-1.1a1.5 1.5 0 0 0-2.1 0l-1.1 1.1Z" /></svg>
)
export const MegaphoneTile = () => (
  <svg {...tile} fill="currentColor"><path d="M3 10v4a1.5 1.5 0 0 0 1.5 1.5H6l1.4 4.3a1 1 0 0 0 1 .7h1.4a1 1 0 0 0 .9-1.3L9.5 15.5H11l7.3 3.9A1.2 1.2 0 0 0 20 18.3V5.7a1.2 1.2 0 0 0-1.7-1.1L11 8.5H4.5A1.5 1.5 0 0 0 3 10Z" /></svg>
)
