-- 개통 중인 매체 현황 보기 (조회만 한다. 아무것도 바꾸지 않는다. 여러 번 실행해도 된다)
--   기준은 운영팀 "개통 현황" 화면과 같다: 고객사 매체(publisher_id 있음) 중 "오픈 준비 중"이 켜진 매체
--   결과 칸이 여러 개라 SQL 에디터에서는 맨 아래 결과만 보인다. 1)~4) 를 하나씩 골라 실행해도 된다

-- 1) 매체별 요약: 체크한 항목, 다음에 할 항목, 답 안 한 고객 코멘트, 시작용 기사 수
with ongoing as (
  select o.id, o.name, o.domain, o.created_at, pb.name as publisher
  from outlets o left join publishers pb on pb.id = o.publisher_id
  where o.publisher_id is not null and coalesce((o.site->>'comingSoon')::boolean, false)
),
keys(ord, key, title) as (values
  (1, 'invite', '발행인 가입·로그인'), (2, 'domain', '도메인 연결'), (3, 'brand', '로고·색·법정 표기'),
  (4, 'sections', '섹션 정리'), (5, 'import', '기사 옮기기 / 시작용 기사 승인'), (6, 'training', '사용법 안내'),
  (7, 'open_switch', '오픈 준비 중 끄기·첫 청구서'), (8, 'indexable', '검색 노출 켜기'),
  (9, 'naver_add', '서치어드바이저 등록'), (10, 'google_add', '서치콘솔 등록'), (11, 'codes', '확인 태그 붙여 넣기'),
  (12, 'verify', '소유 확인'), (13, 'naver_sitemap', '네이버 사이트맵·RSS'), (14, 'google_sitemap', '구글 사이트맵'),
  (15, 'google_owner', '서치콘솔 소유자 추가'), (16, 'naver_news', '뉴스제휴 안내'), (17, 'check_week', '1주 뒤 색인 확인')
)
select g.name as "매체", g.publisher as "고객사", g.domain as "도메인", g.created_at::date as "개설일",
  coalesce(l.done ? 'fresh_start', false) as "새로 시작",
  (select string_agg(k.title, ', ' order by k.ord) from keys k where l.done ? k.key) as "끝낸 항목",
  (select string_agg(k.title, ', ' order by k.ord) from keys k where not coalesce(l.done ? k.key, false)) as "남은 항목",
  (select count(*) from launch_comments c where c.outlet_id = g.id and not c.from_staff and not c.staff_seen) as "안 읽은 고객 글",
  (select count(*) from articles a where a.outlet_id = g.id and a.status = 'in_review') as "승인 대기 기사",
  (select count(*) from articles a where a.outlet_id = g.id and a.status = 'draft') as "작성 중 기사",
  (select count(*) from articles a where a.outlet_id = g.id and a.status = 'published') as "발행 기사"
from ongoing g left join launch_checklists l on l.outlet_id = g.id
order by g.created_at desc;

-- 2) 개통 중 매체의 코멘트 (최근 것부터, 매체마다 20건)
select o.name as "매체", c.created_at as "시각", case when c.from_staff then '운영팀' else '고객' end as "누가",
  c.author_name as "이름", c.step_id as "단계", c.staff_seen as "운영팀 읽음", c.body as "내용"
from launch_comments c join outlets o on o.id = c.outlet_id
where o.publisher_id is not null and coalesce((o.site->>'comingSoon')::boolean, false)
  and c.id in (select c2.id from launch_comments c2 where c2.outlet_id = c.outlet_id order by c2.created_at desc limit 20)
order by o.name, c.created_at desc;

-- 3) 개통 중 매체의 계정 (편집장 이름 확인용: 시작용 기사 기자명은 편집장 이름)
select o.name as "매체", p.full_name as "이름", p.role as "권한", p.created_at::date as "만든 날"
from profiles p join outlets o on o.id = p.outlet_id
where o.publisher_id is not null and coalesce((o.site->>'comingSoon')::boolean, false)
order by o.name, p.role desc, p.created_at;

-- 4) 개통 중 매체의 기사 기자명 분포 ('편집국'·'IM뉴스룸'·'관리자'가 남아 있으면 fix-starter-byline.sql 로 고친다)
select o.name as "매체", coalesce(nullif(btrim(a.byline), ''), pr.full_name, '(없음)') as "기자명", a.status as "상태", count(*) as "기사 수"
from articles a join outlets o on o.id = a.outlet_id left join profiles pr on pr.id = a.author_id
where o.publisher_id is not null and coalesce((o.site->>'comingSoon')::boolean, false)
group by 1, 2, 3 order by 1, 2, 3;
