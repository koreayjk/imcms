import { permanentRedirect } from 'next/navigation'

// 팡고링고 옛 첫 화면(/ko-kr)은 첫 화면으로
export default function PangolingoHome() {
  permanentRedirect('/')
}
