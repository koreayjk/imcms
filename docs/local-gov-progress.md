# 지자체 보도자료 수집 진행표 (예약 작업이 계속 갱신한다)

목표: 전국 지자체(광역 17 + 시·군·구 226, 조사 목록은 운영 DB 표 `public.gov_survey` — slug·name·url) 보도자료 **수집**을 가능한 곳 전부 붙인다. 기사 작성과는 무관.
규칙·요령은 `docs/local-gov-survey.md`, 코드는 `lib/press-local.ts`(BOARDS 규칙표·파서)와 `lib/press-sources.ts`(출처 등록).

## 작업 순서 (한 번에 6~10곳)
1. 이 문서의 "완료"·"불가"에 없는 slug를 `public.gov_survey`에서 고른다 (시·군·구 우선, 지역 근처끼리 묶기).
2. 운영 Supabase(프로젝트 `xmkrpjsetdneulyyasrf`)에서 `net.http_get(url, timeout_milliseconds := 25000)` 로 메인/보도자료 목록을 받는다 (샌드박스는 한국 지자체 사이트에 못 간다). 응답은 `net._http_response` 에서 잠시 뒤 읽는다. 임시 테이블을 만들지 말고 `select ... net.http_get(...) from (values ...)` 형태만 쓴다.
3. 메뉴에서 "보도자료" 링크를 찾는다 → 목록 모양·상세 주소·본문 칸을 확인한다. 같은 모양이면 기존 어댑터를 쓴다: `selectBbsNttList.do` 형은 adapter `ntt`, 나머지는 `board` + `BOARDS` 규칙(id 정규식·link·body).
4. 로컬에서 실제 마크업 조각으로 파서를 시험하고 `npx tsc --noEmit -p .` 통과를 확인한다.
5. `lib/press-sources.ts` 에 `lg-*` 출처를 추가하고 커밋·푸시한다 (브랜치 `claude/new-newsroom-launch-lddv9w`, PR #29 에 쌓임). **머지는 하지 않는다** (사람이 한다).
6. 이 문서를 고쳐 커밋한다: 붙인 곳은 "완료(배포 전)", 불가능한 구조는 "불가"(사유 한 줄), 아직 불확실하면 "재시도"(횟수).

## 하지 않는 것
- 접속 대기열·봇 확인(쿠키/화면크기 검사)·로그인·차단을 우회하지 않는다. 막히면 "불가"로 적고 넘어간다.
- 서버 시간 초과(응답 없음)는 한 번 더 시도해 보고(총 2회) 그래도 없으면 "불가(응답 없음)".
- 한 곳이 어려우면 오래 붙들지 말고 다음 곳으로 간다.
- 기사 자동 작성 설정은 건드리지 않는다.

## 완료 — 이미 운영 수집 중 (확인됨)
광역: seoul, incheon, gyeonggi(경기도), chungbuk, chungnam, daejeon, gyeongbuk, jeju (+ 경기도뉴스포털 시군 `lg-gg-sigun`; 양주 gyeonggi-26 은 이 경로로 들어옴)
시·군·구: gyeonggi-09 안산, gyeonggi-07 평택(목록만), chungnam-05 서산, gangwon-10 영월, gyeonggi-08 동두천, gyeonggi-31 양평, seoul-12 은평, seoul-19 영등포, seoul-14 마포

## 완료 — 코드만 있음, 배포·수집 확인 전 (PR #29)
gyeonggi-18 하남, seoul-18 금천, ulsan-03 울산동구, gyeonggi-17 의왕, jeonnam-16 무안, chungnam-08 당진, incheon-05 남동, incheon-06 부평, incheon-03 미추홀, seoul-05 광진, seoul-16 강서, seoul-20 동작, jeonnam-01 목포, jeonnam-04 나주, gangwon-01 춘천, gwangju-05 광산, seoul-11 노원, gyeonggi-20 파주, seoul-01 종로, busan-04 영도, gyeongnam-02 진주, gyeonggi-02 성남, seoul-15 양천, ulsan-05 울주, gyeongnam-05 김해, seoul-08 성북, seoul-24 송파, seoul-17 구로, seoul-22 서초, seoul-23 강남, seoul-25 강동

## 완료 — 코드만 있음 (2차, 같은 PR)
seoul-08·24·17·22·23·25(위에 포함), gyeonggi-12 구리, gyeonggi-13 남양주, gyeonggi-16 군포, gyeonggi-23 김포, gyeonggi-27 포천, gyeonggi-29 연천, gyeonggi-01 수원, gyeonggi-06 광명, incheon-08 서(서해)구, incheon-09 강화, incheon-04 연수

## 등록했으나 운영에서 안 됨
seoul-07 중랑 (프로덕션 fetch failed)

## 불가 (시도했으나 불가능한 구조 — 다시 하지 않는다)
- gyeonggi-24 화성: 접속 대기열(NetFunnel)
- seoul-09 강북: 봇 확인(쿠키·화면 크기 검사)
- seoul-02 중구, seoul-03 용산, seoul-04 성동, seoul-21 관악: 응답 없음(서버 접속 차단 추정)
- seoul-06 동대문: 게시판이 4월 12일에서 멈춤
- jeonnam-03 순천: 상세 주소가 목록으로 돌아옴
- chungnam-07 계룡, chungnam-01 천안: 목록이 자바스크립트로 불러와져 서버가 못 읽음
- chungbuk-07 증평: 위와 같은 증상
- 광역: gwangju·jeonnam(통합특별시 새 사이트 주소 미확인), daegu(모음 글), busan(SSL), ulsan(상세 404), sejong·gangwon·jeonbuk(보도자료 주소 미확인 — 재시도 가능)

## 재시도 (불확실)
- gyeonggi-10 고양(목록은 읽히나 상세 주소 규칙 못 찾음 `fnView('1090',ID,'/news')`), gyeonggi-05 부천(보도자료 최신 글이 5월), gyeonggi-11 과천·gyeonggi-14 오산·gyeonggi-21 이천·gyeonggi-25 광주시(`contents.do` 목록, 글 링크 못 찾음), gyeonggi-04 안양·gyeonggi-15 시흥·gyeonggi-22 안성(첫 화면 안내만, 메뉴 못 찾음)
- 응답 없음 1회: gyeonggi-03 의정부, gyeonggi-19 용인, gyeonggi-28 여주, incheon-02 동구, incheon-07 계양, incheon-10 옹진(링크 없음), gyeonggi-30 가평(404)
- chungbuk-06 영동(보도자료 메뉴 없음, 군정뉴스만), chungbuk-09 괴산, gangwon-14 화천, seoul-13 서대문(인코딩), seoul-10 도봉
- 광역 sejong·gangwon·jeonbuk 보도자료 주소 찾기, busan 주소·SSL 재확인

## 실행 기록
- 2026-11-04: 진행표 작성. 예약 작업 시작.
- 2026-11-04 (대화 세션): 경기·인천 1차 점검 — 11곳 추가.
