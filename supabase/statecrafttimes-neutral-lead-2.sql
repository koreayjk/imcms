-- The Statecraft Times 첫 화면 톱을 IMF 기사로 (Supabase SQL 에디터에서 실행. 여러 번 실행해도 된다)
--   앞서 실행한 statecrafttimes-neutral-lead.sql 다음에 실행한다.
--   큰 자리(톱)는 "고정한 기사 → 대표 표시 기사 → 사진 있는 첫 기사" 순서로 정해진다.
--   노벨상·AI 성명 기사의 사진 주소는 열리지 않아서(외부 사이트 제한·삭제) 사진을 비우고, 사진이 열리는 IMF 기사를 톱으로 올린다.
do $$
declare oid uuid;
begin
  select id into oid from outlets where name = 'The Statecraft Times' limit 1;
  if oid is null then raise exception 'The Statecraft Times 매체를 찾지 못했습니다.'; end if;

  -- 1) 사진이 열리지 않는 두 기사는 사진을 비운다 (글만 있는 기사로 보인다)
  update articles set thumbnail_url = null
   where outlet_id = oid and title in (
     'Navi Pillay Wins Nobel Peace Prize for Strengthening International Law',
     'More Than 300 Scientists Call for Tighter Controls on AI Cybersecurity Risks');

  -- 2) 발행 시각: IMF가 가장 최근
  update articles set published_at = case title
     when 'IMF Warns Global Economy Nears Limits of Resilience as Oil Buffers Shrink' then now()
     when 'Navi Pillay Wins Nobel Peace Prize for Strengthening International Law' then now() - interval '1 minute'
     when 'More Than 300 Scientists Call for Tighter Controls on AI Cybersecurity Risks' then now() - interval '2 minutes'
   end
   where outlet_id = oid and title in (
     'IMF Warns Global Economy Nears Limits of Resilience as Oil Buffers Shrink',
     'Navi Pillay Wins Nobel Peace Prize for Strengthening International Law',
     'More Than 300 Scientists Call for Tighter Controls on AI Cybersecurity Risks');

  -- 3) 대표 표시(is_featured)가 걸린 다른 기사는 풀고 IMF 기사에 건다
  update articles set is_featured = (title = 'IMF Warns Global Economy Nears Limits of Resilience as Oil Buffers Shrink')
   where outlet_id = oid and (is_featured or title = 'IMF Warns Global Economy Nears Limits of Resilience as Oil Buffers Shrink');

  -- 4) 편집판에서 톱 자리를 고정해 둔 것이 있으면 푼다 (표가 없으면 그냥 넘어간다)
  begin
    update home_layouts set layout = layout - 'headline' where outlet_id = oid;
  exception when others then
    raise notice '편집판 고정 해제는 건너뜁니다: %', sqlerrm;
  end;
end $$;

-- 확인: 위쪽 5건 (IMF → 노벨상 → AI 성명 순)
select a.title, a.published_at, a.is_featured, a.thumbnail_url is not null as has_photo
  from articles a join outlets o on o.id = a.outlet_id
 where o.name = 'The Statecraft Times' and a.status = 'published'
 order by a.published_at desc limit 5;
