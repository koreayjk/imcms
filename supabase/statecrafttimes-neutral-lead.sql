-- The Statecraft Times: 첫 화면 톱기사를 중립적인 기사로 (Supabase SQL 에디터에서 실행. 여러 번 실행해도 된다)
--   발행 시각만 "지금"으로 올려서 최신 기사 순서의 맨 위 세 자리를 바꾼다. 기사 내용은 건드리지 않는다.
--   톱: 노벨 평화상 · 2번째: AI 보안 과학자 성명 · 3번째: IMF 세계경제 경고
update articles a
   set published_at = case a.title
     when 'Navi Pillay Wins Nobel Peace Prize for Strengthening International Law' then now()
     when 'More Than 300 Scientists Call for Tighter Controls on AI Cybersecurity Risks' then now() - interval '1 minute'
     when 'IMF Warns Global Economy Nears Limits of Resilience as Oil Buffers Shrink' then now() - interval '2 minutes'
   end
  from outlets o
 where a.outlet_id = o.id and o.name = 'The Statecraft Times'
   and a.title in (
     'Navi Pillay Wins Nobel Peace Prize for Strengthening International Law',
     'More Than 300 Scientists Call for Tighter Controls on AI Cybersecurity Risks',
     'IMF Warns Global Economy Nears Limits of Resilience as Oil Buffers Shrink');

-- 확인: 위 세 기사가 맨 위에 와야 한다
select a.title, a.published_at
  from articles a join outlets o on o.id = a.outlet_id
 where o.name = 'The Statecraft Times' and a.status = 'published'
 order by a.published_at desc limit 5;
