const base = {
  width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
}

export const NewsroomIcon = () => (
  <svg {...base}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 8h6M7 12h10M7 16h10" /></svg>
)
export const WriteIcon = () => (
  <svg {...base}><path d="M4 20h4L19 9l-4-4L4 16v4Z" /><path d="m13.5 6.5 4 4" /></svg>
)
export const ListIcon = () => (
  <svg {...base}><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1" /><circle cx="4.5" cy="12" r="1" /><circle cx="4.5" cy="18" r="1" /></svg>
)
export const FolderIcon = () => (
  <svg {...base}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" /></svg>
)
export const UsersIcon = () => (
  <svg {...base}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6" /></svg>
)
export const BuildingIcon = () => (
  <svg {...base}><path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 10h4a1 1 0 0 1 1 1v10M3 21h18M8 8h3M8 12h3M8 16h3" /></svg>
)
export const SearchIcon = () => (
  <svg {...base} width={18} height={18}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4.5 4.5" /></svg>
)
export const ExternalIcon = () => (
  <svg {...base} width={14} height={14}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>
)
export const ImageIcon = () => (
  <svg {...base} width={18} height={18}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 17-5.5-5.5L5 20" /></svg>
)
export const VideoIcon = () => (
  <svg {...base} width={18} height={18}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m10 9 5 3-5 3V9Z" /></svg>
)
