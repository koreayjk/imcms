-- 느린 화면 점검 (읽기만 한다. 아무것도 바뀌지 않는다. Supabase SQL 에디터에서 실행)
-- ① 표 크기: 보도자료·기사가 몇 건인지 (보도자료가 수만 건이면 보도자료함 목록이 느려진다)
select 'press_releases' as 표, count(*) as 건수, pg_size_pretty(pg_total_relation_size('press_releases')) as 크기 from press_releases
union all
select 'articles', count(*), pg_size_pretty(pg_total_relation_size('articles')) from articles
union all
select 'press_fetch_log', count(*), pg_size_pretty(pg_total_relation_size('press_fetch_log')) from press_fetch_log;

-- ② 가장 오래 걸리는 DB 조회 15개 (평균 시간 순). 보도자료·기사 조회가 위에 있는지 본다
--   (별도로 실행: 위 ①을 지우고 이것만 실행해도 된다)
-- select left(query, 160) as 조회, calls as 횟수, round(mean_exec_time::numeric, 1) as 평균ms, round(total_exec_time::numeric / 1000) as 합계초
-- from pg_stat_statements
-- where calls > 20 and query not ilike '%pg_stat_statements%'
-- order by mean_exec_time desc limit 15;
