-- 뉴스폭탄 편집장 계정(hyeon5962@naver.com) 이름을 이호현으로 되돌리고,
-- 이름이 이문희로 바뀐 뒤에 쓰이거나 고쳐진 이 계정의 기사도 이호현으로 맞춘다
-- (Supabase SQL 에디터에서 실행, 여러 번 실행해도 된다)
do $fix$
declare
  v_email text := 'hyeon5962@naver.com';
  v_old text := '이문희';
  v_new text := '이호현';
  v_outlet text := '뉴스폭탄';
  uid uuid;
  oid uuid;
  n_acc int := 0;
  n_by int := 0;
  n_body int := 0;
begin
  select id into uid from auth.users where lower(email) = lower(v_email);
  if uid is null then raise exception '% 계정을 찾지 못했습니다.', v_email; end if;
  select id into oid from outlets where name = v_outlet order by created_at limit 1;

  update profiles set full_name = v_new where id = uid and full_name is distinct from v_new;
  get diagnostics n_acc = row_count;

  -- 이 계정이 쓴 뉴스폭탄 기사 중 기자명이 이문희인 것
  update articles set byline = v_new
  where outlet_id = oid and author_id = uid and btrim(coalesce(byline, '')) = v_old;
  get diagnostics n_by = row_count;

  update articles
  set body = regexp_replace(body, '(\[' || v_outlet || '=)' || v_old || '( 기자\])', '\1' || v_new || '\2')
  where outlet_id = oid and author_id = uid and body ~ ('\[' || v_outlet || '=' || v_old || ' 기자\]');
  get diagnostics n_body = row_count;

  raise notice '계정 이름 %건 · 기자명 %건 · 본문 첫머리 %건 바꿈', n_acc, n_by, n_body;
end
$fix$;
