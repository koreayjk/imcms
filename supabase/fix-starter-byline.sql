-- 개통할 때 운영팀이 AI로 써 준 시작용 기사의 기자명을 "그 매체 편집장 이름"으로 바꾼다
--   (Supabase SQL 에디터에서 실행. 여러 번 실행해도 된다)
--   · 매체 이름·편집장 이름은 아래 두 줄만 고쳐 쓰면 다른 매체에도 그대로 쓸 수 있다
--   · 바뀌는 것: ① 기사 기자명(byline)  ② 본문 첫머리 표기 "[매체=편집국]" → "[매체=이호현 기자]"
--               ③ 편집장 계정이 이미 있으면 기사 작성자도 그 계정으로
--   · 기자명이 'IM뉴스룸'·'편집국'·'관리자'(또는 비어 있어 작성자 계정 이름이 나가는 기사)였던 것만 바꾼다.
--     기자가 직접 쓴 기사는 건드리지 않는다
do $fix$
declare
  v_outlet text := '뉴스폭탄';   -- 매체 이름
  v_editor text := '이호현';     -- 편집장 이름
  oid uuid;
  eid uuid;
  n_by int := 0;
  n_body int := 0;
  n_author int := 0;
begin
  select id into oid from outlets where name = v_outlet order by created_at limit 1;
  if oid is null then raise exception '% 매체를 찾지 못했습니다. outlets 표의 이름을 확인해 주세요.', v_outlet; end if;

  -- 편집장 계정 (같은 이름이 여러 개면 이 매체 소속을 먼저)
  select p.id into eid from profiles p where p.full_name = v_editor
  order by (p.outlet_id = oid) desc nulls last, p.created_at limit 1;

  -- 바꿀 기사: 기자명이 기본값이거나, 비어 있는데 작성자 계정 이름이 기본값인 기사
  create temp table _starter on commit drop as
  select a.id from articles a
  left join profiles pr on pr.id = a.author_id
  where a.outlet_id = oid
    and coalesce(nullif(btrim(a.byline), ''), pr.full_name) in ('IM뉴스룸', 'IM 뉴스룸', '편집국', '관리자', 'IM Newsroom');

  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'articles' and column_name = 'byline') then
    update articles a set byline = v_editor from _starter s where a.id = s.id and a.byline is distinct from v_editor;
    get diagnostics n_by = row_count;
  else
    raise notice 'articles.byline 칸이 없어 기자명은 건너뜁니다 (article-manage.sql 을 먼저 실행해 주세요)';
  end if;

  -- 본문 첫머리 "[매체=편집국]" 표기
  update articles a
  set body = regexp_replace(a.body, '^<p>\[[^\]=]+=(편집국|IM뉴스룸|IM 뉴스룸|관리자)( 기자)?\]', '<p>[' || v_outlet || '=' || v_editor || ' 기자]')
  from _starter s
  where a.id = s.id and a.body ~ '^<p>\[[^\]=]+=(편집국|IM뉴스룸|IM 뉴스룸|관리자)( 기자)?\]';
  get diagnostics n_body = row_count;

  if eid is not null then
    update articles a set author_id = eid from _starter s where a.id = s.id and a.author_id is distinct from eid;
    get diagnostics n_author = row_count;
  else
    raise notice '% 계정이 아직 없어 기사 작성자 계정은 그대로 둡니다 (기자명만 바뀝니다)', v_editor;
  end if;

  raise notice '%: 대상 기사 %건 · 기자명 %건 · 본문 표기 %건 · 작성자 계정 %건 바꿈', v_outlet, (select count(*) from _starter), n_by, n_body, n_author;
end
$fix$;
