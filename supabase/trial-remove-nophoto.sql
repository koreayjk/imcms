-- IM 체험뉴스에서 사진 없는 샘플 기사 지우기 (Supabase SQL 에디터에서 실행. 여러 번 실행해도 된다)
--   대표 사진이 비었거나, 지운 Israel Today 표지 그림(/sites/israeltoday/covers/…)을 가리키는 샘플 기사를 지운다
--   체험 가입자가 직접 쓴 기사는 건드리지 않는다 (체험 중인 기사일 수 있다)

do $$
declare
  o uuid := public.trial_outlet();
  n int;
begin
  if o is null then raise exception '체험신문이 없습니다.'; end if;

  delete from articles
   where outlet_id = o and is_sample
     and (nullif(btrim(coalesce(thumbnail_url, '')), '') is null
          or thumbnail_url like '%/sites/israeltoday/covers/%');
  get diagnostics n = row_count;

  -- 홈 편집판에 고정해 둔 자리는 비운다 (지운 기사가 걸려 있을 수 있다)
  if n > 0 then delete from home_layouts where outlet_id = o; end if;

  raise notice '사진 없는 샘플 기사 % 건을 지웠습니다.', n;
end $$;

-- 결과: 섹션별 샘플 기사 수와 사진 없는 기사 수 (사진 없음 열이 모두 0 이면 끝)
select c.name as "섹션",
       count(a.id) as "샘플 기사",
       count(a.id) filter (where nullif(btrim(coalesce(a.thumbnail_url, '')), '') is null) as "사진 없음"
from categories c
left join articles a on a.category_id = c.id and a.is_sample
where c.outlet_id = public.trial_outlet()
group by c.name, c.sort_order
order by c.sort_order;
