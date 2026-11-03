# 전국 지자체 보도자료 수집 조사 (2026-11-03)

광역 17곳 + 시·군·구 226곳 홈페이지(`lib/local-gov.ts`)에 요청을 한 번씩 보내 사이트 종류와 접속 가능 여부를 확인했다. Supabase 서버(해외 IP 가능성)에서 요청한 결과이며, 운영 서버(서울 지역 Vercel)에서는 다를 수 있다. 슬러그는 `lib/local-gov.ts`의 slug(광역은 id).

| 묶음 | 곳 수 | 특징 | 슬러그 |
|---|---|---|---|
| A. `selectBbsNttList.do` | 15 | `/www/selectBbsNttList.do?bbsNo=…&key=…` | chungbuk, chungbuk-06/07/09, chungnam-05, gangwon-10/14, gyeonggi-08/18/26/31, seoul-12/18/19, ulsan-03 |
| B. `/portal/contents.do`·`/portal/bbs/` | 25 | 포털형 | busan-02/10/12/13/15, daegu-02/07, daejeon-02, gyeongbuk-01/04/05, gyeonggi-11/14/21/22/25, gyeongnam-02/05, jeonnam-01/03, seoul-01/05/07/14/20 |
| C. eGov `cop/bbs/…/selectBoardList.do` | 6 | 전자정부 표준 | chungnam-08/12, daegu, ulsan-01/04/05 |
| D. `*.web` (경남형) | 6 | | busan-04, gyeongnam-01/03/04/16, seoul-11 |
| E. `index.do?menuUid` / `menuCd=DOM_` | 18 | 전북·부산 구 | busan-01/03/05/07/11/16, jeonbuk, jeonbuk-03/04/05/06/08/10/11/12/13/14, jeonnam-06 |
| F. `board.es` (광주형) | 12 | | daegu-04/08, daejeon-05, gwangju-02/03/04, gyeonggi-17, jeju, jeonnam, jeonnam-05, seoul-15, ulsan |
| G. `report.jsp` (인천 구) | 5 | | incheon-05/06/08/09/10 |
| H. `www/common/bbs` (안산형) | 1 | 이미 수집 중 | gyeonggi-09 |
| W. 기타(제각각) | 53 | 시마다 다름 | 서울시, 경기 수원·성남·부천, 평택(이미 수집) 등 |
| Z. 이동 페이지(JS/대기열) | 54 | 첫 화면이 자바스크립트 이동·대기열이라 한 번 더 따라가야 함 | 화성(대기열), 경기도 본청(보안 차단), 서울 중랑·성북·강북·구로·서초·강남·송파·강동 등 |
| X. 응답 없음/시간 초과 | 41 | 서버가 25초 안에 답하지 않음 | 다시 시도 필요 |
| Y. HTTP 오류 | 8 | | chungnam-11, daegu-01, gyeongbuk-03/07/12/16, gyeongnam-12, incheon-04 |

## 읽는 법
- A·B·C·E·F처럼 같은 묶음은 보도자료 게시판 주소만 다르고 목록 모양이 비슷해, 한 묶음당 수집기 하나로 여러 곳을 처리할 가능성이 있다(묶음 안에서도 변형이 있어 곳마다 확인 필요).
- RSS가 노출된 곳은 10곳뿐이다.
- 이미 쓰는 것: 경기도뉴스포털(`lg-gg-do`, `lg-gg-sigun`), 안산(H, `lg-ansan`), 평택(`lg-pyeongtaek`, 목록만).
- 다음 순서 제안: ① 묶음 A(15곳) 수집기 ② 광역 17곳 보도자료 게시판 주소 확인 ③ 묶음 B·E·F ④ Z·X 다시 시도.

## A형 수집 진행 (2026-11-03)
- 수집 중(보도자료 게시판 확인, `lg-*`): 충청북도, 서산시, 영월군, 동두천시, 양평군, 서울 은평구, 서울 영등포구 — 같은 파서(`parseNttList`/`parseNttDetail`)로 목록·본문을 읽는다. 본문 칸 이름이 사이트마다 달라(`contenttext`, `bbs_content`, `p-table__content`, `viewcontent`) 차례로 찾는다.
- 아직 안 붙인 A형: 영동군(chungbuk-06), 증평군(07), 괴산군(09), 화천군(gangwon-14), 하남시(gyeonggi-18), 양주시(26), 금천구(seoul-18), 울산 동구(ulsan-03). 홈페이지에서 '보도자료' 게시판의 bbsNo·key를 찾아야 한다. 추측으로 넣었더니 괴산은 정보공개, 화천은 민원사무편람, 하남은 공지사항 게시판이었다. 양주는 '언론보도'(보도자료 아님)였고 경기도뉴스포털 시군 보도자료로 이미 일부 들어온다.
