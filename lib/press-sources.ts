export type PressSource = {
  key: string
  name: string
  url: string
  // newswire: 목록은 RSS, 전문은 기사 페이지에서 가져온다 / rss: RSS 설명란을 그대로 전문으로 쓴다
  // foreign: 해외 언론(영문) 기사. 목록은 RSS 요약만, 전문은 열 때 기사 페이지에서 읽는다.
  //          보도자료가 아니므로 AI는 번역하지 않고 출처를 밝힌 한국어 기사로 새로 쓴다 (매체 설정 '해외 언론 자료 받기'를 켠 매체만 본다)
  //   us: 미국(영문) 출처. 영문 매체(site.lang = en)만 본다. 목록은 RSS, 전문은 기사 페이지에서 읽고, AI가 영어 기사로 새로 쓴다
  kind: 'newswire' | 'rss' | 'foreign' | 'us' | 'gov'
  // gov: 지자체 게시판을 직접 읽는 출처 (press-local.ts). adapter 가 읽는 방법을 정한다
  adapter?: 'ansan' | 'gnews' | 'pyeongtaek' | 'ntt' | 'board' | 'incheon' | 'seoul' | 'jeju' | 'gyeongbuk'
  // 미국 출처 중 매체 지역·기관 소식: 추천 탭에 키워드 없이도 늘 보인다 (전국 뉴스와이어는 추천 키워드가 제목에 있을 때만)
  local?: boolean
  // 해외 언론: 기사에 밝힐 매체 이름
  outlet?: string
}

// 해외 언론 묶음: 매체 설정에서 묶음마다 켠다 (출처 key 는 묶음의 앞글자로 시작한다)
export type ForeignTopic = 'israel' | 'education' | 'reformed' | 'mission' | 'thailand' | 'malaysia' | 'shipping' | 'kchurch'
export const FOREIGN_TOPICS: { key: ForeignTopic; prefix: string; label: string; hint: string }[] = [
  { key: 'israel', prefix: 'il-', label: '이스라엘 언론', hint: '예루살렘포스트·JNS·와이넷 등' },
  { key: 'education', prefix: 'ed-', label: '해외 교육·유학 언론', hint: 'Inside Higher Ed·The PIE News·ICEF Monitor 등' },
  { key: 'mission', prefix: 'ms-', label: '해외 선교 언론', hint: 'IMB·OMF·위클리프·ICC(박해받는 교회)·크리스채너티투데이' },
  { key: 'reformed', prefix: 'rf-', label: '해외 개혁주의·기독교교육 언론', hint: '가스펠코얼리션·리포메이션21·9Marks·고전기독교학교협회(ACCS) 등' },
  { key: 'thailand', prefix: 'th-', label: '태국 언론', hint: '태국관광청·방콕포스트·타이거 등' },
  { key: 'malaysia', prefix: 'my-', label: '말레이시아 언론', hint: 'MIDA(투자청)·베르나마·말레이메일 등' },
  { key: 'shipping', prefix: 'sh-', label: '해운·물류 업계 언론', hint: 'Splash247·gCaptain·Seatrade·Hellenic Shipping News' },
  { key: 'kchurch', prefix: 'kc-', label: '한국 교계 언론', hint: '기독신문·뉴스앤조이·기독일보' },
]
export const foreignTopicOf = (key: string): ForeignTopic | null => FOREIGN_TOPICS.find((t) => key.startsWith(t.prefix))?.key ?? null
// 미국(영문) 출처: 키가 us- 로 시작. 영문 매체만 보고, 한국어 매체는 보지 않는다
export const US_PREFIX = 'us-'
export const isUsSource = (key: string) => key.startsWith(US_PREFIX)
export const isForeignSource = (key: string) => foreignTopicOf(key) !== null || isUsSource(key)

// 뉴스와이어: 언론사가 하루 5건을 넘게 쓰려면 뉴스와이어의 사전 허락이 필요하다 (저작권 안내)
export const NEWSWIRE_DAILY_FREE = 5

export const PRESS_SOURCES: PressSource[] = [
  // ───── 미국(영문) 출처: 영문 매체(예: Breaking BCS) 전용 ─────
  { key: 'us-prn-texas', name: 'PR Newswire · Texas', outlet: 'PR Newswire', url: 'https://www.prnewswire.com/rss/texas-latest-news/texas-latest-news-list.rss', kind: 'us', local: true },
  { key: 'us-prn-sports', name: 'PR Newswire · Sports', outlet: 'PR Newswire', url: 'https://www.prnewswire.com/rss/sports-latest-news/sports-latest-news-list.rss', kind: 'us' },
  { key: 'us-prn-health', name: 'PR Newswire · Health', outlet: 'PR Newswire', url: 'https://www.prnewswire.com/rss/health-latest-news/health-latest-news-list.rss', kind: 'us' },
  { key: 'us-prn-consumer', name: 'PR Newswire · Consumer & lifestyle', outlet: 'PR Newswire', url: 'https://www.prnewswire.com/rss/consumer-products-latest-news/consumer-products-latest-news-list.rss', kind: 'us' },
  { key: 'us-prn-all', name: 'PR Newswire · All news', outlet: 'PR Newswire', url: 'https://www.prnewswire.com/rss/news-releases-list.rss', kind: 'us' },
  { key: 'us-tamu-today', name: 'Texas A&M Today', outlet: 'Texas A&M University', url: 'https://today.tamu.edu/feed/', kind: 'us', local: true },
  // 브라조스 밸리(브라이언·칼리지스테이션) 지역 공식 출처: 시청·대학·도서관 소식 (영문 매체 Breaking BCS 용)
  { key: 'us-cstx-news', name: 'City of College Station · News', outlet: 'City of College Station', url: 'https://www.cstx.gov/news/rss', kind: 'us', local: true },
  { key: 'us-bryan-news', name: 'City of Bryan · News', outlet: 'City of Bryan', url: 'https://www.bryantx.gov/news/rss', kind: 'us', local: true },
  { key: 'us-agrilife', name: 'Texas A&M AgriLife Today', outlet: 'Texas A&M AgriLife Today', url: 'https://agrilifetoday.tamu.edu/feed/', kind: 'us', local: true },
  { key: 'us-bcslibrary', name: 'Bryan + College Station Public Library System', outlet: 'Bryan + College Station Public Library System', url: 'https://www.bcslibrary.org/feed/', kind: 'us', local: true },
  { key: 'us-txgov', name: 'Office of the Texas Governor', outlet: 'Office of the Texas Governor', url: 'https://gov.texas.gov/news/rss', kind: 'us', local: true },
  { key: 'us-fda', name: 'U.S. FDA · Press releases', outlet: 'U.S. Food and Drug Administration', url: 'https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml', kind: 'us' },
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
  // 교육 (에듀와이드 등): 교육 일반·대학·초중등·유아·학원·온라인·직업교육
  { key: 'nw-edu', name: '뉴스와이어 · 교육 일반', url: 'https://api.newswire.co.kr/rss/industry/1101', kind: 'newswire' },
  { key: 'nw-university', name: '뉴스와이어 · 대학교', url: 'https://api.newswire.co.kr/rss/industry/1102', kind: 'newswire' },
  { key: 'nw-secondary', name: '뉴스와이어 · 중등교육', url: 'https://api.newswire.co.kr/rss/industry/1103', kind: 'newswire' },
  { key: 'nw-primary', name: '뉴스와이어 · 초등교육', url: 'https://api.newswire.co.kr/rss/industry/1104', kind: 'newswire' },
  { key: 'nw-academy', name: '뉴스와이어 · 학원', url: 'https://api.newswire.co.kr/rss/industry/1105', kind: 'newswire' },
  { key: 'nw-elearning', name: '뉴스와이어 · 온라인 교육', url: 'https://api.newswire.co.kr/rss/industry/1106', kind: 'newswire' },
  { key: 'nw-vocational', name: '뉴스와이어 · 직업교육', url: 'https://api.newswire.co.kr/rss/industry/1107', kind: 'newswire' },
  { key: 'nw-preschool', name: '뉴스와이어 · 유아교육', url: 'https://api.newswire.co.kr/rss/industry/1108', kind: 'newswire' },
  // 해외 교육·유학 언론 (에듀와이드 등 '해외 교육·유학 언론'을 켠 매체): 미국 대학·초중등, 국제 유학 동향, 에듀테크
  { key: 'ed-ihe', name: '해외 · 인사이드하이어에드', outlet: '인사이드하이어에드(Inside Higher Ed)', url: 'https://www.insidehighered.com/rss.xml', kind: 'foreign' },
  { key: 'ed-highereddive', name: '해외 · 하이어에드다이브', outlet: '하이어에드다이브(Higher Ed Dive)', url: 'https://www.highereddive.com/feeds/news/', kind: 'foreign' },
  { key: 'ed-k12dive', name: '해외 · K-12 다이브', outlet: 'K-12 다이브(K-12 Dive)', url: 'https://www.k12dive.com/feeds/news/', kind: 'foreign' },
  { key: 'ed-the74', name: '해외 · 더74', outlet: '더74(The 74)', url: 'https://www.the74million.org/feed/', kind: 'foreign' },
  { key: 'ed-hechinger', name: '해외 · 헤칭거리포트', outlet: '헤칭거리포트(The Hechinger Report)', url: 'https://hechingerreport.org/feed/', kind: 'foreign' },
  { key: 'ed-pie', name: '해외 · 더파이뉴스(유학)', outlet: '더파이뉴스(The PIE News)', url: 'https://thepienews.com/feed/', kind: 'foreign' },
  { key: 'ed-icef', name: '해외 · ICEF 모니터(유학)', outlet: 'ICEF 모니터(ICEF Monitor)', url: 'https://monitor.icef.com/feed/', kind: 'foreign' },
  { key: 'ed-edsurge', name: '해외 · 에드서지(에듀테크)', outlet: '에드서지(EdSurge)', url: 'https://www.edsurge.com/articles_rss', kind: 'foreign' },
  // 개혁주의·기독교교육 언론 (다음세대타임즈 등 '해외 개혁주의·기독교교육 언론'을 켠 매체): 개혁신학·교회·기독교학교·고전 기독교교육
  //   CiRCE 연구소·아퀼라리포트는 서버 접속을 막아(403) 원문을 읽을 수 없어 뺐다
  { key: 'rf-tgc', name: '해외 · 가스펠코얼리션', outlet: '가스펠코얼리션(The Gospel Coalition)', url: 'https://www.thegospelcoalition.org/feed/', kind: 'foreign' },
  { key: 'rf-ref21', name: '해외 · 리포메이션21', outlet: '리포메이션21(Reformation21)', url: 'https://www.reformation21.org/rss', kind: 'foreign' },
  { key: 'rf-9marks', name: '해외 · 9Marks(교회)', outlet: '9Marks', url: 'https://www.9marks.org/feed/', kind: 'foreign' },
  { key: 'rf-accs', name: '해외 · ACCS(기독교 고전교육 학교)', outlet: '고전기독교학교협회(ACCS)', url: 'https://classicalchristian.org/feed/', kind: 'foreign' },
  // 선교 언론 (월드미션타임즈 등 '해외 선교 언론'을 켠 매체): 선교 현장·미전도 종족·성경번역·박해 소식
  { key: 'ms-imb', name: '해외 · IMB(국제선교이사회)', outlet: 'IMB(미국 남침례교 국제선교이사회)', url: 'https://www.imb.org/feed/', kind: 'foreign' },
  { key: 'ms-omf', name: '해외 · OMF', outlet: 'OMF 인터내셔널', url: 'https://www.omf.org/us/feed/', kind: 'foreign' },
  { key: 'ms-wycliffe', name: '해외 · 위클리프(성경번역)', outlet: '위클리프 성경번역선교회(Wycliffe)', url: 'https://www.wycliffe.org/feed', kind: 'foreign' },
  { key: 'ms-icc', name: '해외 · ICC(박해받는 교회)', outlet: '국제기독연대(ICC)', url: 'https://www.persecution.org/feed/', kind: 'foreign' },
  { key: 'ms-ct', name: '해외 · 크리스채너티투데이', outlet: '크리스채너티투데이(Christianity Today)', url: 'https://www.christianitytoday.com/feed/', kind: 'foreign' },
  // 이스라엘 언론 (Israel Today 등 '이스라엘 언론'을 켠 매체). 타임스오브이스라엘·이스라엘하욤은 서버 접속을 막을 때가 있다
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
  // 태국 언론 (치앙마이 타임즈 등 '태국 언론'을 켠 매체): 관광청 공식 자료 + 영자 언론
  { key: 'th-tat', name: '해외 · 태국관광청 뉴스룸', outlet: '태국관광청(TAT)', url: 'https://www.tatnews.org/feed/', kind: 'foreign' },
  { key: 'th-bkkpost', name: '해외 · 방콕포스트', outlet: '방콕포스트(Bangkok Post)', url: 'https://www.bangkokpost.com/rss/data/topstories.xml', kind: 'foreign' },
  { key: 'th-bkkpost-biz', name: '해외 · 방콕포스트 경제', outlet: '방콕포스트(Bangkok Post)', url: 'https://www.bangkokpost.com/rss/data/business.xml', kind: 'foreign' },
  { key: 'th-thaiger', name: '해외 · 타이거', outlet: '타이거(The Thaiger)', url: 'https://thethaiger.com/feed', kind: 'foreign' },
  // 말레이시아 언론 (말레이시아 타임즈 등)
  { key: 'my-mida', name: '해외 · 말레이시아 투자청(MIDA)', outlet: '말레이시아 투자개발청(MIDA)', url: 'https://www.mida.gov.my/feed/', kind: 'foreign' },
  { key: 'my-bernama', name: '해외 · 베르나마', outlet: '베르나마(Bernama)', url: 'https://www.bernama.com/en/rssfeed.php?cat=general', kind: 'foreign' },
  { key: 'my-malaymail', name: '해외 · 말레이메일', outlet: '말레이메일(Malay Mail)', url: 'https://www.malaymail.com/feed/rss/malaysia', kind: 'foreign' },
  // 해운·물류 업계 언론 (Shipping Times 등)
  { key: 'sh-splash', name: '해외 · Splash247', outlet: '스플래시247(Splash247)', url: 'https://splash247.com/feed/', kind: 'foreign' },
  { key: 'sh-gcaptain', name: '해외 · gCaptain', outlet: 'gCaptain', url: 'https://gcaptain.com/feed/', kind: 'foreign' },
  { key: 'sh-seatrade', name: '해외 · 시트레이드 마리타임', outlet: '시트레이드 마리타임(Seatrade Maritime)', url: 'https://www.seatrade-maritime.com/rss.xml', kind: 'foreign' },
  { key: 'sh-hellenic', name: '해외 · 헬레닉 시핑뉴스', outlet: '헬레닉 시핑뉴스(Hellenic Shipping News)', url: 'https://www.hellenicshippingnews.com/feed/', kind: 'foreign' },
  // 한국 교계 언론 (선교·다음세대 매체): 한국어 기사 — 문장을 옮기지 않고 사실만 골라 새로 쓴다
  { key: 'kc-kidok', name: '교계 · 기독신문', outlet: '기독신문', url: 'https://www.kidok.com/rss/allArticle.xml', kind: 'foreign' },
  { key: 'kc-newsnjoy', name: '교계 · 뉴스앤조이', outlet: '뉴스앤조이', url: 'https://www.newsnjoy.or.kr/rss/allArticle.xml', kind: 'foreign' },
  { key: 'kc-christiandaily', name: '교계 · 기독일보', outlet: '기독일보', url: 'https://www.christiandaily.co.kr/rss', kind: 'foreign' },
  // 지자체 보도자료 (게시판을 직접 읽는다): 안산시, 경기도뉴스포털(경기도 본청 + 31개 시군 — 화성·평택 포함, 제목·담당부서에 시군 이름이 나온다)
  { key: 'lg-ansan', name: '안산시 보도자료', url: 'https://www.ansan.go.kr/www/common/bbs/selectPageListBbs.do?bbs_code=B0238', kind: 'gov', adapter: 'ansan' },
  { key: 'lg-pyeongtaek', name: '평택시 보도자료', url: 'https://www.pyeongtaek.go.kr/pyeongtaek/board/post/list.do?bcIdx=90&mid=0402010000', kind: 'gov', adapter: 'pyeongtaek' },
  // 표준 게시판형(selectBbsNttList.do) 지자체 보도자료 — 서울·충북·충남·강원·경기 일부
  { key: 'lg-chungbuk', name: '충청북도 보도자료', url: 'https://www.chungbuk.go.kr/www/selectBbsNttList.do?bbsNo=65&key=429', kind: 'gov', adapter: 'ntt' },
  { key: 'lg-seosan', name: '서산시 보도자료', url: 'https://www.seosan.go.kr/www/selectBbsNttList.do?bbsNo=101&key=1260', kind: 'gov', adapter: 'ntt' },
  { key: 'lg-yeongwol', name: '영월군 보도자료', url: 'https://www.yw.go.kr/www/selectBbsNttList.do?bbsNo=19&key=21', kind: 'gov', adapter: 'ntt' },
  { key: 'lg-dongducheon', name: '동두천시 보도자료', url: 'https://www.ddc.go.kr/ddc/selectBbsNttList.do?bbsNo=95&key=1914', kind: 'gov', adapter: 'ntt' },
  { key: 'lg-yangpyeong', name: '양평군 보도자료', url: 'https://www.yp21.go.kr/www/selectBbsNttList.do?bbsNo=2&key=1112', kind: 'gov', adapter: 'ntt' },
  { key: 'lg-eunpyeong', name: '서울 은평구 보도자료', url: 'https://www.ep.go.kr/www/selectBbsNttList.do?bbsNo=48&key=762', kind: 'gov', adapter: 'ntt' },
  { key: 'lg-yeongdeungpo', name: '서울 영등포구 보도자료', url: 'https://www.ydp.go.kr/www/selectBbsNttList.do?bbsNo=45&key=2868', kind: 'gov', adapter: 'ntt' },
  // 사이트마다 모양이 다른 게시판 (규칙은 press-local.ts 의 BOARDS)
  { key: 'lg-jungnang', name: '서울 중랑구 보도자료', url: 'https://www.jungnang.go.kr/portal/bbs/list/B0000151.do?menuNo=200474', kind: 'gov', adapter: 'board' },
  { key: 'lg-mapo', name: '서울 마포구 보도자료', url: 'https://www.mapo.go.kr/site/main/board/press/list', kind: 'gov', adapter: 'board' },
  { key: 'lg-incheon', name: '인천광역시 보도자료', url: 'https://www.incheon.go.kr/IC010205', kind: 'gov', adapter: 'incheon' },
  { key: 'lg-seoul', name: '서울특별시 보도자료', url: 'https://www.seoul.go.kr/news/news_report.do', kind: 'gov', adapter: 'seoul' },
  { key: 'lg-chungnam', name: '충청남도 보도자료', url: 'https://www.chungnam.go.kr/cnportal/cnapcPressList/cnapcPress/list.do?menuNo=500498', kind: 'gov', adapter: 'board' },
  { key: 'lg-hanam', name: '하남시 보도자료', url: 'https://www.hanam.go.kr/www/selectBbsNttList.do?bbsNo=1164&key=10221', kind: 'gov', adapter: 'ntt' },
  { key: 'lg-geumcheon', name: '서울 금천구 보도자료', url: 'https://www.geumcheon.go.kr/portal/selectBbsNttList.do?bbsNo=8&key=297', kind: 'gov', adapter: 'ntt' },
  { key: 'lg-ulsan-donggu', name: '울산 동구 보도자료', url: 'https://www.donggu.ulsan.kr/cop/bbs/selectBoardList.do?bbsId=BBSMSTR_000000000322', kind: 'gov', adapter: 'board' },
  { key: 'lg-uiwang', name: '의왕시 보도자료', url: 'https://www.uiwang.go.kr/UWKORINFO0201', kind: 'gov', adapter: 'board' },
  { key: 'lg-muan', name: '무안군 보도자료', url: 'https://www.muan.go.kr/www/openmuan/new/report', kind: 'gov', adapter: 'board' },
  { key: 'lg-dangjin', name: '당진시 보도자료', url: 'https://www.dangjin.go.kr/cop/bbs/BBSMSTR_000000000014/selectBoardList.do', kind: 'gov', adapter: 'board' },
  { key: 'lg-namdong', name: '인천 남동구 보도자료', url: 'https://www.namdong.go.kr/main/news/report.jsp', kind: 'gov', adapter: 'board' },
  { key: 'lg-bupyeong', name: '인천 부평구 보도자료', url: 'https://www.icbp.go.kr/bbs/bbsMsgList.do?bcd=report', kind: 'gov', adapter: 'board' },
  { key: 'lg-michuhol', name: '인천 미추홀구 보도자료', url: 'https://www.michuhol.go.kr/main/board/list.do?board_code=news_item', kind: 'gov', adapter: 'board' },
  { key: 'lg-gwangjin', name: '서울 광진구 보도자료', url: 'https://www.gwangjin.go.kr/portal/bbs/B0000002/list.do?menuNo=200191', kind: 'gov', adapter: 'board' },
  { key: 'lg-gangseo', name: '서울 강서구 보도자료', url: 'https://www.gangseo.seoul.kr/gs040201', kind: 'gov', adapter: 'board' },
  { key: 'lg-dongjak', name: '서울 동작구 보도자료', url: 'https://www.dongjak.go.kr/portal/bbs/B0000171/list.do?menuNo=200647', kind: 'gov', adapter: 'board' },
  { key: 'lg-mokpo', name: '목포시 보도자료', url: 'https://www.mokpo.go.kr/www/mokpo_news/press_release', kind: 'gov', adapter: 'board' },
  { key: 'lg-naju', name: '나주시 보도자료', url: 'https://www.naju.go.kr/www/administration/reporting/coverage', kind: 'gov', adapter: 'board' },
  { key: 'lg-chuncheon', name: '춘천시 보도자료', url: 'https://www.chuncheon.go.kr/cityhall/about-chuncheon/promotion/news-material/', kind: 'gov', adapter: 'board' },
  { key: 'lg-gwangsan', name: '광주 광산구 보도자료', url: 'https://www.gwangsan.go.kr/boardList.do?boardId=REPORT_NEW&pageId=www16', kind: 'gov', adapter: 'board' },
  { key: 'lg-nowon', name: '서울 노원구 보도자료', url: 'https://www.nowon.kr/www/user/bbs/BD_selectBbsList.do?q_bbsCode=1027', kind: 'gov', adapter: 'board' },
  { key: 'lg-paju', name: '파주시 보도자료', url: 'https://www.paju.go.kr/user/board/BD_board.list.do?bbsCd=1023&q_ctgCds=5226,5227,5229', kind: 'gov', adapter: 'board' },
  { key: 'lg-daejeon', name: '대전광역시 보도자료', url: 'https://www.daejeon.go.kr/drh/board/boardNormalList.do?boardId=normal_0189&menuSeq=1632', kind: 'gov', adapter: 'board' },
  { key: 'lg-jeju', name: '제주특별자치도 보도자료', url: 'https://www.jeju.go.kr/news/bodo/list.htm', kind: 'gov', adapter: 'jeju' },
  { key: 'lg-gyeongbuk', name: '경상북도 보도자료', url: 'https://www.gb.go.kr/page/link.do?mn=10107&pageNo=10004', kind: 'gov', adapter: 'gyeongbuk' },
  { key: 'lg-gg-sigun', name: '경기도뉴스포털 · 시군 보도자료', url: 'https://gnews.gg.go.kr/briefing/brief_sigun.do', kind: 'gov', adapter: 'gnews' },
  { key: 'lg-gg-do', name: '경기도뉴스포털 · 경기도 보도자료', url: 'https://gnews.gg.go.kr/briefing/brief_gongbo.do', kind: 'gov', adapter: 'gnews' },
  // 정책브리핑(korea.kr) RSS는 2026-07-01에 서비스가 중단되어 뺐다 (저작권 보호를 이유로 제공 방식 변경).
  //   이미 받아 둔 'kr-press' 보도자료는 보도자료함에 그대로 남는다. 정부 보도자료는 부처 메일 구독 → 보도자료 메일함으로 받는다
]

export function findPressSource(key: string) {
  return PRESS_SOURCES.find((s) => s.key === key)
}

// 보도자료 분야: 매체마다 '추천' 탭에 넣을 뉴스와이어 분류 묶음
//   분야를 고른 매체의 추천 탭 = 그 분야 분류 + 켠 해외 언론 + 메일·직접 등록 + (정부·공공기관 보도자료 중 제목에 추천 키워드가 있는 것)
//   words: 매체 설정에서 분야를 아직 고르지 않았을 때 추천 키워드로 분야를 짐작하는 데 쓴다
export type PressField = 'medical' | 'shipping' | 'education'
export const PRESS_FIELDS: { key: PressField; label: string; sources: string[]; words: string[] }[] = [
  { key: 'medical', label: '의료·복지', sources: ['nw-hospital', 'nw-elderly', 'nw-welfare', 'nw-medicine', 'nw-pharma', 'nw-device'], words: ['의료', '병원', '복지', '요양', '돌봄', '노인', '제약'] },
  { key: 'shipping', label: '해운·물류·무역', sources: ['nw-logistics', 'nw-shipping', 'nw-airline', 'nw-shipbuilding', 'nw-ocean', 'nw-trade'], words: ['해운', '물류', '항만', '선박', '조선', '무역'] },
  { key: 'education', label: '교육', sources: ['nw-edu', 'nw-university', 'nw-secondary', 'nw-primary', 'nw-academy', 'nw-elearning', 'nw-vocational', 'nw-preschool'], words: ['교육', '학교', '대학', '입시'] },
]
// 분야에 속하지 않는 출처(정부·공공기관 등)는 제목 키워드로만 추천에 넣는다
export const fieldOfSource = (key: string): PressField | null => PRESS_FIELDS.find((f) => f.sources.includes(key))?.key ?? null

// 추천 분야·키워드를 따로 정하지 않은 매체: 매체의 섹션(메뉴) 이름으로 추천을 알아서 정한다
//   · 기사 형식·공통 메뉴(오피니언·칼럼·포토·종합 등)는 주제가 아니므로 뺀다
//   · 교육·의료·물류 같은 분야 섹션은 그 분야의 뉴스와이어 분류를 통째로 넣고, 나머지는 섹션 이름과 가까운 단어를 제목 키워드로 쓴다
const SECTION_SKIP = /^(종합|뉴스|전체|홈|오피니언|사설|칼럼|기자수첩|기고|인터뷰|기획|특집|기획특집|포토|포토뉴스|영상|동영상|로컬|사회|사회종합|국제이슈|이슈|속보|포토|사진|opinion|editorial|column|interview|feature|photo|video|news|local|world|home|all)$/i
const SECTION_WORDS: [RegExp, string[]][] = [
  [/인공지능|^ai$|AI/, ['인공지능', '생성형', '딥러닝']],
  [/빅데이터/, ['빅데이터', '데이터센터']],
  [/4차산업|산업/, ['4차산업', '스마트', '자율주행', '로봇', '반도체']],
  [/경제|금융|재테크/, ['경제', '수출', '금융', '투자']],
  [/정치|국회/, ['국회', '대통령', '정당']],
  [/스포츠|체육/, ['스포츠', '리그', '우승']],
  [/문화|공연|전시|예술/, ['문화', '공연', '전시', '축제']],
  [/연예|방송/, ['드라마', '가수', '영화']],
  [/부동산/, ['부동산', '아파트', '분양']],
  [/환경|기후/, ['환경', '탄소', '기후']],
  [/과학|기술|IT|테크/, ['기술', '플랫폼', '개발']],
  [/농업|농촌|농산/, ['농업', '농촌', '농산물']],
  [/관광|여행/, ['관광', '여행', '축제']],
  [/건강|의료|병원/, ['건강', '의료', '병원']],
]
export function pressHintsFromSections(names: string[]): { keywords: string[]; fields: PressField[] } {
  const kw = new Set<string>()
  const fields = new Set<PressField>()
  for (const raw of names) {
    const name = raw.trim()
    if (!name || SECTION_SKIP.test(name.replace(/[\s·・/]+/g, ''))) continue
    for (const f of PRESS_FIELDS) if (f.words.some((w) => name.includes(w)) || name.includes(f.label.split('·')[0])) fields.add(f.key)
    const hit = SECTION_WORDS.filter(([re]) => re.test(name))
    if (hit.length) hit.forEach(([, ws]) => ws.forEach((w) => kw.add(w)))
    else kw.add(name.replace(/(종합|뉴스|소식)$/, '').trim())
  }
  return { keywords: usableKeywords([...kw]).filter((w) => w.length >= 2).slice(0, 40), fields: [...fields] }
}

// 추천 키워드로 쓸 단어: 짧은 영문 약어(IB, AI 등)는 다른 단어 속에 섞여 엉뚱한 자료가 걸리므로 뺀다
export function usableKeywords(words: string[]) {
  return words.map((w) => w.replace(/[,()*%\\]/g, '').trim()).filter((w) => w && !(/^[\x00-\x7F]+$/.test(w) && w.length < 4))
}
