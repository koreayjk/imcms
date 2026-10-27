-- 기자명 고정 (Supabase SQL 에디터에서 한 번 실행, 여러 번 실행해도 된다)
--   문제: 기자명이 회원 이름과 같으면 칸을 비워 두는 방식이라, 회원 이름(설정·내 정보)을 바꾸면
--         그 회원이 쓴 모든 기사의 기자명이 같이 바뀌었다 (본문 첫머리 [매체=이름 기자] 는 안 바뀜).
--   고침: ① 기사를 저장할 때 기자명이 비어 있으면 작성자 이름을 그 자리에서 적어 둔다 (이후 이름을 바꿔도 안 변함)
--         ② 지금 기자명이 빈 기사는 본문 첫머리 [매체=이름 기자] 의 이름으로 채우고, 그 표기가 없으면 작성자 현재 이름으로 채운다
--   ※ 이미 이름이 바뀐 뒤라서, 본문 첫머리가 옛 이름(예: 이호현)이면 옛 이름으로 돌아온다.
--     본문 첫머리까지 새 이름으로 고쳐 둔 기사는 새 이름으로 고정된다.
--   고친 기사(발행·승인신청 상태)는 '수정 이력'에 고치기 전 내용이 남는다

alter table articles add column if not exists byline text;

-- ① 앞으로: 기자명이 비어 있으면 작성자 이름으로 채운다
create or replace function articles_fill_byline()
returns trigger as $$
begin
  if nullif(btrim(coalesce(new.byline, '')), '') is null and new.author_id is not null then
    new.byline := (select nullif(btrim(full_name), '') from profiles where id = new.author_id);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists articles_fill_byline on articles;
create trigger articles_fill_byline before insert or update of byline, author_id on articles
  for each row execute function articles_fill_byline();

-- ② 지금까지: 비어 있는 기자명 채우기
with t as (
  select a.id,
         coalesce(
           nullif(btrim((regexp_match(a.body, '^\s*<p[^>]*>\s*\[[^\]=]+=\s*([^\]]+?)\s*기자\]'))[1]), ''),
           nullif(btrim(p.full_name), '')
         ) as name
  from articles a
  left join profiles p on p.id = a.author_id
  where nullif(btrim(coalesce(a.byline, '')), '') is null
)
update articles a set byline = t.name from t where a.id = t.id and t.name is not null;

-- 확인: 뉴스폭탄 기사의 기자명별 건수
--   select a.byline, count(*) from articles a join outlets o on o.id = a.outlet_id where o.name = '뉴스폭탄' group by 1 order by 2 desc;
