import type { HomeLayout } from '@/lib/home-layouts'

// 홈 배치 고르기 칸의 작은 배치 그림 (회색 = 사진, 짙은 막대 = 제목)
const P = '#CBD1DB'
const L = '#9AA1AD'
const D = '#4B5360'
const B = '#1D3461'

const Bar = ({ x, y, w, c = L, h = 2.5 }: { x: number; y: number; w: number; c?: string; h?: number }) => <rect x={x} y={y} width={w} height={h} rx="1" fill={c} />
const Img = ({ x, y, w, h, r = 1.5 }: { x: number; y: number; w: number; h: number; r?: number }) => <rect x={x} y={y} width={w} height={h} rx={r} fill={P} />

export default function HomeLayoutThumb({ layout }: { layout: HomeLayout }) {
  return (
    <svg viewBox="0 0 120 84" role="img" aria-hidden className="h-auto w-full rounded border border-line bg-white">
      {layout === 'standard' && (<>
        <rect x="4" y="4" width="112" height="5" rx="1" fill={B} />
        <Img x={4} y={13} w={24} h={17} /><Bar x={4} y={33} w={22} c={D} /><Img x={4} y={40} w={24} h={17} /><Bar x={4} y={60} w={22} c={D} />
        <Img x={32} y={13} w={56} h={34} /><Bar x={44} y={50} w={32} c={D} h={3} /><Bar x={40} y={56} w={40} />
        <Bar x={92} y={13} w={14} c={B} /><Bar x={92} y={19} w={24} /><Bar x={92} y={24} w={24} /><Bar x={92} y={29} w={24} /><Bar x={92} y={34} w={24} /><Bar x={92} y={39} w={24} />
        <Img x={4} y={66} w={26} h={12} /><Img x={33} y={66} w={26} h={12} /><Img x={62} y={66} w={26} h={12} /><rect x="92" y="66" width="24" height="12" rx="1" fill="none" stroke={P} />
      </>)}
      {layout === 'portal' && (<>
        <rect x="4" y="4" width="112" height="5" rx="1" fill={B} />
        <rect x="4" y="12" width="112" height="5" rx="1" fill="none" stroke={P} /><rect x="6" y="13.2" width="9" height="2.6" rx="1" fill="#D6402B" />
        <Img x={4} y={21} w={66} h={34} /><Bar x={8} y={46} w={50} c="#fff" h={3} /><Bar x={8} y={51} w={30} c="#fff" />
        <Img x={74} y={21} w={11} h={8} /><Bar x={88} y={22} w={26} c={D} /><Bar x={88} y={26} w={18} />
        <Bar x={74} y={33} w={42} c={D} /><Bar x={74} y={39} w={42} c={D} /><Bar x={74} y={45} w={42} c={D} /><Bar x={74} y={51} w={42} c={D} />
        <rect x="4" y="60" width="40" height="20" rx="1" fill="none" stroke={P} /><rect x="48" y="60" width="40" height="20" rx="1" fill="none" stroke={P} /><rect x="92" y="60" width="24" height="20" rx="1" fill="none" stroke={P} />
        <Bar x={7} y={63} w={14} c={B} /><Bar x={7} y={69} w={32} /><Bar x={7} y={74} w={32} /><Bar x={51} y={63} w={14} c={B} /><Bar x={51} y={69} w={32} /><Bar x={51} y={74} w={32} />
      </>)}
      {layout === 'bands' && (<>
        <rect x="4" y="4" width="112" height="5" rx="1" fill={B} />
        <rect x="4" y="13" width="112" height="22" rx="2" fill="#EEF1F6" /><Bar x={9} y={18} w={38} c={D} h={3} /><Bar x={9} y={24} w={30} c={D} h={3} /><Bar x={9} y={30} w={24} /><Img x={52} y={13} w={64} h={22} r={2} />
        <rect x="4" y="37" width="112" height="19" rx="1" fill="#EEF1F6" /><Bar x={7} y={39} w={20} c={B} />
        <Img x={7} y={44} w={24} h={9} /><Img x={34} y={44} w={24} h={9} /><Img x={61} y={44} w={24} h={9} /><Img x={88} y={44} w={24} h={9} />
        <rect x="4" y="59" width="112" height="19" rx="1" fill="#EEF1F6" /><Bar x={7} y={61} w={20} c="#D6402B" />
        <Bar x={7} y={67} w={50} c={D} /><Bar x={7} y={72} w={50} /><Bar x={62} y={67} w={50} c={D} /><Bar x={62} y={72} w={50} />
      </>)}
      {layout === 'editorial' && (<>
        <text x="60" y="13" textAnchor="middle" fontFamily="serif" fontWeight="700" fontSize="9" letterSpacing="1.5" fill="#14171C">THE DAILY</text>
        <rect x="4" y="16" width="112" height="1.2" fill="#14171C" /><Bar x={30} y={19} w={60} c={P} h={1.5} /><rect x="4" y="23" width="112" height="0.6" fill={L} />
        <Bar x={4} y={28} w={26} c={D} /><Bar x={4} y={33} w={26} /><rect x="4" y="38" width="26" height="0.6" fill={L} /><Bar x={4} y={42} w={26} c={D} /><Bar x={4} y={47} w={26} />
        <Img x={36} y={27} w={48} h={30} /><Bar x={36} y={60} w={48} c={D} h={3} /><Bar x={36} y={66} w={40} />
        <rect x="34" y="27" width="0.6" height="40" fill={P} /><rect x="86" y="27" width="0.6" height="40" fill={P} />
        <Bar x={90} y={28} w={14} c="#D6402B" /><circle cx="94" cy="38" r="4" fill={P} /><Bar x={101} y={37} w={15} c={D} />
        <circle cx="92" cy="49" r="1.5" fill="#D6402B" /><Bar x={96} y={48} w={20} c={D} /><circle cx="92" cy="55" r="1.5" fill="#D6402B" /><Bar x={96} y={54} w={20} c={D} />
        <rect x="4" y="71" width="112" height="1.2" fill="#14171C" /><Bar x={4} y={75} w={24} c={D} /><Bar x={33} y={75} w={24} c={D} /><Bar x={62} y={75} w={24} c={D} /><Bar x={91} y={75} w={24} c={D} />
      </>)}
      {layout === 'cards' && (<>
        <Bar x={4} y={5} w={16} c={B} h={3.5} /><Bar x={70} y={6} w={8} c={P} /><Bar x={81} y={6} w={8} c={P} /><Bar x={92} y={6} w={8} c={P} /><rect x="103" y="4.5" width="13" height="5" rx="2.5" fill={B} />
        <Img x={4} y={13} w={112} h={34} r={5} /><rect x="8" y="35" width="10" height="3.5" rx="1" fill="#D6402B" /><Bar x={8} y={40} w={60} c="#fff" h={3} />
        <Img x={4} y={51} w={35} h={14} r={4} /><Img x={43} y={51} w={35} h={14} r={4} /><Img x={82} y={51} w={34} h={14} r={4} />
        <Bar x={4} y={68} w={30} c={D} /><Bar x={43} y={68} w={30} c={D} /><Bar x={82} y={68} w={30} c={D} />
        <rect x="4" y="75" width="112" height="6" rx="1.5" fill="#EEF1F6" /><rect x="100" y="76.2" width="13" height="3.6" rx="1.8" fill={B} />
      </>)}
    </svg>
  )
}
