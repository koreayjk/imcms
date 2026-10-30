-- 말레이시아 타임즈 매체 이름을 'Malaysia Times' → '말레이시아 타임즈'로 바꾼 뒤, 기사 첫머리 표기를 맞춘다
--   (Supabase SQL 에디터에서 실행. 여러 번 실행해도 된다. 매체 이름은 홈페이지 설정에서 먼저 바꿔 둔다)
--   바뀌는 것: ① 기사 본문 첫머리 [Malaysia Times=Johan 기자] → [말레이시아 타임즈=Johan 기자]
--             ② 하단 법적 고지의 회사명이 옛 이름(Malaysia Times) 그대로면 새 이름으로
--   그대로 두는 것: 기자명(Johan)·기사 상태·발행 시각·도메인·로고·사진·영문 이름(MALAYSIA TIMES)
--   고친 기사는 '수정 이력'에 고치기 전 내용이 남는다
do $$
declare
  oid uuid;
  nm text;
  n int;
begin
  select id, name into oid, nm from outlets
  where name ilike '%말레이시아%타임즈%' order by created_at limit 1;
  if oid is null then
    raise exception '말레이시아 타임즈 매체를 찾지 못했습니다. 홈페이지 설정에서 매체 이름이 "말레이시아 타임즈"로 바뀌었는지 확인해 주세요.';
  end if;

  update articles a
  set body = regexp_replace(a.body, '^<p>\[[^\]=]*=Johan 기자\]', '<p>[' || nm || '=Johan 기자]')
  where a.outlet_id = oid
    and a.body ~ '^<p>\[[^\]=]*=Johan 기자\]'
    and a.body not like '<p>[' || nm || '=Johan 기자]%';
  get diagnostics n = row_count;

  update outlets set site = jsonb_set(site, '{legal,company}', to_jsonb(nm))
  where id = oid and site->'legal'->>'company' in ('Malaysia Times', 'MALAYSIA TIMES');

  raise notice '%: 기사 %건의 첫머리 표기를 [%=Johan 기자]로 고쳤습니다', nm, n, nm;
end $$;

-- 확인: 새 이름 표기가 총 기사 수와 같아야 하고, 옛 이름 표기는 0이어야 한다
select o.name as "매체",
  count(*) as "기사 수",
  count(*) filter (where a.body like '<p>[' || o.name || '=Johan 기자]%') as "새 이름 표기",
  count(*) filter (where a.body like '<p>[Malaysia Times=%') as "옛 이름 표기",
  o.site->'legal'->>'company' as "법적 고지 회사명"
from outlets o join articles a on a.outlet_id = o.id
where o.name ilike '%말레이시아%타임즈%'
group by o.name, o.site->'legal'->>'company';
