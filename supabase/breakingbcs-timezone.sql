-- Breaking BCS 날짜·시각을 미국 중부 시간(CT)으로 (Supabase SQL 에디터에서 실행, 여러 번 실행해도 된다)
--   기사 날짜 옆에 "CT"가 붙고, 시간도 텍사스 시간으로 나온다. 앞으로는 홈페이지 설정(운영팀)에서도 바꿀 수 있다
update outlets
set site = jsonb_set(coalesce(site, '{}'::jsonb), '{timeZone}', to_jsonb('America/Chicago'::text))
where name = 'Breaking BCS';

select name as 매체, site->>'timeZone' as 시간대 from outlets where name = 'Breaking BCS';
