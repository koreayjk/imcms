export type PressSource = {
  key: string
  name: string
  url: string
  // newswire: 목록은 RSS, 전문은 기사 페이지에서 가져온다 / rss: RSS 설명란을 그대로 전문으로 쓴다
  // foreign: 해외 언론(영문) 기사. 목록은 RSS 요약만, 전문은 열 때 기사 페이지에서 읽는다.
  //          보도자료가 아니므로 AI는 번역하지 않고 출처를 밝힌 한국어 기사로 새로 쓴다 (매체 설정 '해외 언론 자료 받기'를 켠 매체만 본다)
  kind: 'newswire' | 'rss' | 'foreign'
  // 해외 언론: 기사에 밝힐 매체 이름
  outlet?: string
}

// 해외 언론 출처 key 는 모두 이 글자로 시작한다
export const FOREIGN_PREFIX = 'il-'
export const isForeignSource = (key: string) => key.startsWith(FOREIGN_PREFIX)

// 뉴스와이어: 언론사가 하루 5건을 넘게 쓰려면 뉴스와이어의 사전 허락이 필요하다 (저작권 안내)
export const NEWSWIRE_DAILY_FREE = 5

export const PRESS_SOURCES: PressSource[] = [
  { key: 'nw-hospital', name: '뉴스와이어 · 의료와 병원', url: 'https://api.newswire.co.kr/rss/industry/1007', kind: 'newswire' },
  { key: 'nw-elderly', name: '뉴스와이어 · 노인', url: 'https://api.newswire.co.kr/rss/industry/1901', kind: 'newswire' },
  { key: 'nw-welfare', name: '뉴스와이어 · 사회복지', url: 'https://api.newswire.co.kr/rss/industry/1903', kind: 'newswire' },
  { key: 'nw-medicine', name: '뉴스와이어 · 의학', url: 'https://api.newswire.co.kr/rss/industry/1002', kind: 'newswire' },
  { key: 'nw-pharma', name: '뉴스와이어 · 제약', url: 'https://api.newswire.co.kr/rss/industry/1001', kind: 'newswire' },
  { key: 'nw-device', name: '뉴스와이어 · 의료기기', url: 'https://api.newswire.co.kr/rss/industry/1006', kind: 'newswire' },
  { key: 'nw-gov', name: '뉴스와이어 · 중앙정부', url: 'https://api.newswire.co.kr/rss/industry/1407', kind: 'newswire' },
  { key: 'nw-public', name: '뉴스와이어 · 공공기관', url: 'https://api.newswire.co.kr/rss/industry/1409', kind: 'newswire' },
  // 국제물류·해운 (Shipping Times 등): 운송·산업·경제 분류
  { key: 'nw-logistics', name: '뉴스와이어 · 물류', url: 'https://api.newswire.co.kr/rss/industry/1802', kind: 'newswire' },
  { key: 'nw-shipping', name: '뉴스와이어 · 해운', url: 'https://api.newswire.co.kr/rss/industry/1805', kind: 'newswire' },
  { key: 'nw-airline', name: '뉴스와이어 · 항공사', url: 'https://api.newswire.co.kr/rss/industry/1804', kind: 'newswire' },
  { key: 'nw-shipbuilding', name: '뉴스와이어 · 조선', url: 'https://api.newswire.co.kr/rss/industry/404', kind: 'newswire' },
  { key: 'nw-ocean', name: '뉴스와이어 · 수산 해양', url: 'https://api.newswire.co.kr/rss/industry/414', kind: 'newswire' },
  { key: 'nw-trade', name: '뉴스와이어 · 무역과 박람회', url: 'https://api.newswire.co.kr/rss/industry/102', kind: 'newswire' },
  // 이스라엘 언론 (Israel Today 등 '해외 언론 자료 받기'를 켠 매체). 타임스오브이스라엘·이스라엘하욤은 서버 접속을 막을 때가 있다
  { key: 'il-jpost', name: '해외 · 예루살렘포스트', outlet: '예루살렘포스트(The Jerusalem Post)', url: 'https://www.jpost.com/rss/rssfeedsisraelnews.aspx', kind: 'foreign' },
  { key: 'il-jpost-mideast', name: '해외 · 예루살렘포스트 중동', outlet: '예루살렘포스트(The Jerusalem Post)', url: 'https://www.jpost.com/rss/rssfeedsmiddleeastnews.aspx', kind: 'foreign' },
  { key: 'il-jpost-archaeology', name: '해외 · 예루살렘포스트 고고학', outlet: '예루살렘포스트(The Jerusalem Post)', url: 'https://www.jpost.com/rss/rssarchaeology', kind: 'foreign' },
  { key: 'il-jpost-judaism', name: '해외 · 예루살렘포스트 유대교', outlet: '예루살렘포스트(The Jerusalem Post)', url: 'https://www.jpost.com/rss/rssfeedsjudaism', kind: 'foreign' },
  { key: 'il-toi', name: '해외 · 타임스오브이스라엘', outlet: '타임스오브이스라엘(The Times of Israel)', url: 'https://www.timesofisrael.com/feed/', kind: 'foreign' },
  { key: 'il-hayom', name: '해외 · 이스라엘하욤', outlet: '이스라엘하욤(Israel Hayom)', url: 'https://www.israelhayom.com/feed/', kind: 'foreign' },
  { key: 'il-ynet', name: '해외 · 와이넷', outlet: '와이넷(Ynetnews)', url: 'https://www.ynetnews.com/Integration/StoryRss3082.xml', kind: 'foreign' },
  { key: 'il-jns', name: '해외 · JNS', outlet: 'JNS(Jewish News Syndicate)', url: 'https://www.jns.org/feed/', kind: 'foreign' },
  { key: 'il-inn', name: '해외 · 아루츠 셰바', outlet: '아루츠 셰바(Israel National News)', url: 'https://www.israelnationalnews.com/Rss.aspx', kind: 'foreign' },
  { key: 'il-cbn', name: '해외 · CBN 이스라엘', outlet: 'CBN 뉴스', url: 'https://www1.cbn.com/app_feeds/rss/news/rss.php?section=israel', kind: 'foreign' },
  // 정책브리핑(korea.kr) RSS는 2026-07-01에 서비스가 중단되어 뺐다 (저작권 보호를 이유로 제공 방식 변경).
  //   이미 받아 둔 'kr-press' 보도자료는 보도자료함에 그대로 남는다. 정부 보도자료는 부처 메일 구독 → 보도자료 메일함으로 받는다
]

export function findPressSource(key: string) {
  return PRESS_SOURCES.find((s) => s.key === key)
}
