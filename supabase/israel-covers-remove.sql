-- Israel Today 표지 그림 정리 (Supabase SQL 에디터에서 실행. 여러 번 실행해도 된다)
--   1) IM 체험뉴스: Israel Today 에서 온 샘플 기사를 뺀다 (원문 사진 없이 표지 그림만 있어 체험용 신문에 어울리지 않는다)
--      빠진 자리: 국제 ← Shipping Times 샘플 셋 중 하나(해외 해운·무역 소식), 문화 ← 더케어타임즈 샘플 다섯 중 하나
--   2) Israel Today: 기사 작성 때 넣은 섹션 표지 그림(/sites/israeltoday/covers/…)을 대표 사진에서 뺀다
--      편집장이 기사를 고칠 때 사진을 넣으면 된다

do $$
declare
  o uuid := public.trial_outlet();
  it uuid := (select id from outlets where name = 'Israel Today' limit 1);
  st uuid := (select id from outlets where name = 'Shipping Times' limit 1);
  ct uuid := (select id from outlets where name = '더케어타임즈' limit 1);
  n_del int;
  n_world int;
  n_culture int;
begin
  if o is null then raise exception '체험신문이 없습니다.'; end if;

  -- 1) Israel Today 에서 온 샘플 (표지 그림 주소 또는 같은 제목)
  delete from articles t
   where t.outlet_id = o and t.is_sample
     and (t.thumbnail_url like '%/sites/israeltoday/%'
          or exists (select 1 from articles s where s.outlet_id = it and s.title = t.title));
  get diagnostics n_del = row_count;

  -- 2) 국제: Shipping Times 에서 온 샘플 셋 중 하나
  with ship as (
    select t.id, row_number() over (order by t.published_at desc) as n
    from articles t
    where t.outlet_id = o and t.is_sample
      and exists (select 1 from articles s where s.outlet_id = st and s.title = t.title)
  )
  update articles a set category_id = (select id from categories where outlet_id = o and slug = 'world')
    from ship where a.id = ship.id and ship.n % 3 = 0;
  get diagnostics n_world = row_count;

  -- 3) 문화: 더케어타임즈 에서 온 샘플 다섯 중 하나 (문화 섹션이 비어 있을 때만)
  if not exists (select 1 from articles a join categories c on c.id = a.category_id
                  where a.outlet_id = o and a.is_sample and c.slug = 'culture') then
    with care as (
      select t.id, row_number() over (order by t.published_at desc) as n
      from articles t
      where t.outlet_id = o and t.is_sample
        and exists (select 1 from articles s where s.outlet_id = ct and s.title = t.title)
    )
    update articles a set category_id = (select id from categories where outlet_id = o and slug = 'culture')
      from care where a.id = care.id and care.n % 5 = 0;
    get diagnostics n_culture = row_count;
  end if;

  -- 홈 편집판에 고정해 둔 자리는 비운다 (지운 기사가 걸려 있을 수 있다)
  delete from home_layouts where outlet_id = o;

  raise notice 'Israel Today 샘플 % 건 삭제, 국제로 % 건, 문화로 % 건 옮김', n_del, n_world, coalesce(n_culture, 0);
end $$;

-- 2) Israel Today 기사의 표지 그림 빼기 (본문에는 넣지 않았으므로 대표 사진만)
update articles a set thumbnail_url = null
  from outlets o
 where o.id = a.outlet_id and o.name = 'Israel Today'
   and a.thumbnail_url like '%/sites/israeltoday/covers/%';

-- 결과: 체험신문 섹션별 샘플 기사 수 (Israel Today 에 표지 그림이 남은 기사 수는 맨 아래 줄)
select "섹션", "기사 수" from (
  select c.name as "섹션", count(a.id) as "기사 수", c.sort_order as ord
  from categories c
  left join articles a on a.category_id = c.id and a.is_sample
  where c.outlet_id = public.trial_outlet()
  group by c.name, c.sort_order
  union all
  select 'Israel Today 표지 그림 남은 기사', count(*), 9999
  from articles a join outlets o on o.id = a.outlet_id
  where o.name = 'Israel Today' and a.thumbnail_url like '%/sites/israeltoday/covers/%'
) r
order by ord;
