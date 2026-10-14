-- 월드미션타임즈 ↔ 치앙마이미션타임즈 이름 바꾸기 (Supabase SQL 에디터에서 실행. 여러 번 실행해도 된다)
--   지금: '치앙마이미션타임즈'로 바꾼다. 나중에 되돌릴 때는 아래 to_name 한 줄만 '월드미션타임즈'로 고쳐 다시 실행한다
--   바뀌는 것: 매체 이름, 영문 이름(로고 아래 글자), 법적 고지의 회사명, 매체 소개 문구,
--             이 매체 기사의 기자 표기([치앙마이미션타임즈=관리자 기자])와 본문·제목·요약 속 매체 이름
--   그대로 두는 것: 주소(도메인)·매체 ID·메뉴·색·슬로건·숫자 판·기사 상태와 발행 시각
--   seed-worldmissiontimes.sql 과 기사 SQL(worldmissiontimes-2026-10*.sql)은 두 이름 모두 알아보므로,
--   이름을 바꾼 뒤에 실행해도 매체가 새로 생기지 않는다. 그 뒤에 기사 SQL을 돌렸다면 이 파일을 한 번 더 실행한다

do $$
declare
  to_name text := '치앙마이미션타임즈';   -- 되돌릴 때: '월드미션타임즈'
  from_name text;
  to_en text;
  from_en text;
  oid uuid;
  n int;
begin
  if to_name = '치앙마이미션타임즈' then
    from_name := '월드미션타임즈'; from_en := 'WORLD MISSION TIMES'; to_en := 'CHIANG MAI MISSION TIMES';
  elsif to_name = '월드미션타임즈' then
    from_name := '치앙마이미션타임즈'; from_en := 'CHIANG MAI MISSION TIMES'; to_en := 'WORLD MISSION TIMES';
  else
    raise exception 'to_name 은 치앙마이미션타임즈 또는 월드미션타임즈 중 하나여야 한다';
  end if;

  select id into oid from outlets where name in (from_name, to_name) order by (name = from_name) desc limit 1;
  if oid is null then
    raise notice '매체를 찾지 못했다. seed-worldmissiontimes.sql 을 먼저 실행한다';
    return;
  end if;
  if exists (select 1 from outlets where name = to_name and id <> oid) then
    raise exception '% 이름의 매체가 이미 따로 있다. 편집국 → 매체에서 확인한다', to_name;
  end if;

  update outlets set name = to_name where id = oid;

  update outlets set site = jsonb_set(site, '{nameEn}', to_jsonb(to_en))
  where id = oid and site->>'nameEn' = from_en;

  update outlets set site = jsonb_set(site, '{description}', to_jsonb(replace(site->>'description', from_name, to_name)))
  where id = oid and site->>'description' like '%' || from_name || '%';

  update outlets set site = jsonb_set(site, '{legal,company}', to_jsonb(to_name))
  where id = oid and site->'legal'->>'company' = from_name;

  update articles set
    title = replace(title, from_name, to_name),
    excerpt = replace(excerpt, from_name, to_name),
    body = replace(body, from_name, to_name)
  where outlet_id = oid
    and (title like '%' || from_name || '%' or excerpt like '%' || from_name || '%' or body like '%' || from_name || '%');
  get diagnostics n = row_count;

  raise notice '% → % 로 바꿨다 (매체 ID %, 기사 %건 수정)', from_name, to_name, oid, n;
end $$;

-- 확인
select id as "매체 ID", name as "매체 이름", site->>'nameEn' as "영문 이름", domain as "주소",
       (select count(*) from articles a where a.outlet_id = o.id) as "기사 수"
from outlets o where name in ('월드미션타임즈', '치앙마이미션타임즈');
