import { permanentRedirect } from 'next/navigation'

// 팡고링고 옛 주소: 기사 목록(/ko-kr/articles?category=코드)은 전체 기사로 (카테고리 코드는 매체마다 달라 이어 주지 않는다)
export default function PangolingoArticleList() {
  permanentRedirect('/news')
}
