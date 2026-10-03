-- 보도자료로 만든 기사 정리 (Supabase SQL 에디터에서 한 번 실행, 여러 번 실행해도 된다)
--   1) 모든 매체: 기사 끝 "※ 이 기사는 ○○에서 배포한 보도자료를 바탕으로 작성됐습니다." 문구를 지운다
--   2) Shipping Times: 기자명이 'Moses Yu'로 나오는 기사를 '관리자'로 바꾸고, 기자 이메일은 비운다
--      (본문 첫머리 [Shipping Times=Moses Yu 기자] 도 [Shipping Times=관리자 기자] 로)
--   고친 기사는 '수정 이력'에 고치기 전 내용이 남는다

-- 1) 출처 문구 지우기
update articles
set body = regexp_replace(
  body,
  '<p>\s*(<em>)?\s*※?\s*(이|본)\s*기사는[^<]{0,80}보도자료를\s*(바탕으로|토대로|기반으로)\s*작성[^<]*(</em>)?\s*</p>',
  '', 'g')
where body ~ '(이|본)\s*기사는[^<]{0,80}보도자료를\s*(바탕으로|토대로|기반으로)\s*작성';

-- 2) Shipping Times 기자명 Moses Yu → 관리자
do $fix$
declare
  st uuid;
  has_email boolean;
  n int;
begin
  select id into st from outlets where name = 'Shipping Times';
  if st is null then raise notice 'Shipping Times 매체가 없습니다.'; return; end if;
  has_email := exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'articles' and column_name = 'byline_email');

  drop table if exists fix_ids;
  create temp table fix_ids on commit drop as
    select a.id from articles a left join profiles p on p.id = a.author_id
    where a.outlet_id = st
      and (lower(trim(coalesce(a.byline, ''))) = 'moses yu'
           or (nullif(trim(coalesce(a.byline, '')), '') is null and lower(trim(p.full_name)) = 'moses yu')
           or a.body ~* '\[[^\]]*=\s*moses yu\s*기자\]');

  update articles a
  set byline = '관리자',
      body = regexp_replace(a.body, '\[([^\]=]*)=\s*[Mm]oses [Yy]u\s*기자\]', '[\1=관리자 기자]')
  where a.id in (select id from fix_ids);
  get diagnostics n = row_count;

  -- 기자 이메일은 DB 규칙이 대표 이메일로 채우므로, 잠깐 그 규칙을 끄고 비운 뒤 다시 켠다
  if has_email then
    if exists (select 1 from pg_trigger where tgname = 'articles_byline_email') then
      alter table articles disable trigger articles_byline_email;
    end if;
    update articles set byline_email = null where id in (select id from fix_ids);
    if exists (select 1 from pg_trigger where tgname = 'articles_byline_email') then
      alter table articles enable trigger articles_byline_email;
    end if;
  end if;

  raise notice 'Shipping Times 기자명 관리자로 바꾼 기사: %건', n;
end
$fix$;

-- 확인
--   select a.byline, count(*) from articles a join outlets o on o.id = a.outlet_id where o.name = 'Shipping Times' group by 1;
--   select count(*) from articles where body ~ '보도자료를\s*바탕으로\s*작성';
