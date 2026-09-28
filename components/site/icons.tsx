const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, 'aria-hidden': true }

export const SearchIcon = () => (
  <svg {...base}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
)
export const MenuIcon = () => (
  <svg {...base}><path d="M4 6.5h16M4 12h16M4 17.5h16" /></svg>
)
export const CloseIcon = () => (
  <svg {...base}><path d="M6 6l12 12M18 6 6 18" /></svg>
)
