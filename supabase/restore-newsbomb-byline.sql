-- 뉴스폭탄: 원래 이호현 기자였던 기사를 이호현으로 되돌린다 (Supabase SQL 에디터에서 실행, 여러 번 실행해도 된다)
--   "원래 이름" = 수정 이력(article_revisions)에 남은 가장 처음 본문의 [뉴스폭탄=○○ 기자] 이름,
--                 이력이 없으면 지금 본문 첫머리의 이름
--   그 이름이 아래 v_editor(이호현)인 기사만 골라서 기자명(byline)과 본문 첫머리를 이호현으로 맞춘다.
--   본문 첫머리가 이문희이고 수정 이력도 없는 기사(처음부터 이문희가 쓴 기사)는 건드리지 않는다.
do $fix$
declare
  v_outlet text := '뉴스폭탄';
  v_editor text := '이호현';
  oid uuid;
  n_by int := 0;
  n_body int := 0;
begin
  select id into oid from outlets where name = v_outlet order by created_at limit 1;
  if oid is null then raise exception '% 매체를 찾지 못했습니다.', v_outlet; end if;

  create temp table _orig on commit drop as
  select a.id,
         coalesce(
           (select (regexp_match(r.body, '\[[^\]=]+=\s*([^\]]+?)\s*기자\]'))[1] from article_revisions r where r.article_id = a.id order by r.changed_at limit 1),
           (regexp_match(a.body, '\[[^\]=]+=\s*([^\]]+?)\s*기자\]'))[1]
         ) as name
  from articles a where a.outlet_id = oid;

  update articles a set byline = v_editor
  from _orig o where a.id = o.id and o.name = v_editor and a.byline is distinct from v_editor;
  get diagnostics n_by = row_count;

  update articles a
  set body = regexp_replace(a.body, '(\[' || v_outlet || '=)[^\]=]+?( 기자\])', '\1' || v_editor || '\2')
  from _orig o
  where a.id = o.id and o.name = v_editor
    and a.body ~ ('\[' || v_outlet || '=(?!' || v_editor || ' 기자\])[^\]=]+? 기자\]');
  get diagnostics n_body = row_count;

  raise notice '%: 이호현으로 맞춘 기사 — 기자명 %건 · 본문 첫머리 %건', v_outlet, n_by, n_body;
end
$fix$;
