-- 말레이시아 타임즈 매체 이름을 'Malaysia Times' → 한국어 이름('말레이시아 타임즈')으로 바꾼 뒤, 기사 첫머리 표기를 맞춘다
--   (Supabase SQL 에디터에서 실행. 여러 번 실행해도 된다. 매체 이름은 홈페이지 설정에서 먼저 바꿔 둔다. 매체는 이름이 아니라 연결된 주소 malaysiatimes.vercel.app 로 찾는다)
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
  -- 매체는 연결된 주소로 먼저 찾는다 (이름을 "타임즈"·"타임스" 등 어떻게 적었든 상관없다)
  select id, name into oid, nm from outlets
  where domain = 'malaysiatimes.vercel.app' or name ilike '%말레이시아%타임%' or name ilike '%malaysia%times%'
  order by (domain = 'malaysiatimes.vercel.app') desc nulls last, created_at limit 1;
  if oid is null then
    raise exception '말레이시아 타임즈 매체를 찾지 못했습니다 (주소 malaysiatimes.vercel.app 도, 이름도 없음). 매체 목록의 이름을 알려 주세요.';
  end if;
  if nm !~ '[가-힣]' then
    raise exception '매체 이름이 아직 "%" 입니다. 홈페이지 설정에서 이름을 한국어(예: 말레이시아 타임즈)로 바꾸고 저장했는지 확인해 주세요.', nm;
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
where o.domain = 'malaysiatimes.vercel.app' or o.name ilike '%말레이시아%타임%' or o.name ilike '%malaysia%times%'
group by o.name, o.site->'legal'->>'company';
