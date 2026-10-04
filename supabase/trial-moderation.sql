-- IM 체험뉴스 발행 전 검사: 욕설·혐오·선정적 표현이 있으면 발행하지 않고 총관리자 확인을 기다린다
--   (Supabase SQL 에디터에서 실행, trial.sql 다음. 여러 번 실행해도 된다)
--   체험신문에 총관리자가 아닌 사람이 기사를 발행하려 하면:
--     1) 서버가 먼저 금칙어와 AI로 검사하고, 통과하면 그 기사 내용의 확인값(moderation_hash)을 같이 넣어 발행한다
--     2) DB가 다시 금칙어를 보고, 확인값이 지금 내용과 다르거나(검사를 거치지 않음) 금칙어가 있으면
--        발행 대신 '승인대기 + 총관리자 확인'(moderation_hold)으로 돌린다
--   보류된 기사는 총관리자만 발행할 수 있다 (총관리자가 승인하면 보류가 풀린다)

alter table articles add column if not exists moderation_hold boolean not null default false;
alter table articles add column if not exists moderation_note text;
alter table articles add column if not exists moderation_hash text;
create index if not exists articles_moderation_hold on articles (outlet_id) where moderation_hold;

-- 금칙어 (정규식). 체험 기사 검사에만 쓴다. 표에 직접 넣거나 빼서 고칠 수 있다
--   걸려도 지우지 않고 총관리자 확인으로 넘기므로, 뜻이 겹치는 말(예: '시발점')은 예외를 둔 정도로만 다듬었다
create table if not exists trial_bad_words (
  pattern text primary key,
  kind text not null check (kind in ('욕설', '혐오', '선정'))
);
alter table trial_bad_words enable row level security;
insert into trial_bad_words (pattern, kind) values
  ('씨[0-9 .]*[발빨팔]', '욕설'), ('시[0-9]*발(?!점)', '욕설'), ('ㅅㅂ|ㅆㅂ|ㅄ|ㅂㅅ|ㅈㄹ|ㅈㄴ|ㄱㅅㄲ', '욕설'),
  ('병[0-9]*신(?!년)', '욕설'), ('개[새세]끼|개색[기끼히]|개쌔끼', '욕설'), ('좆|존나|ㅈ같', '욕설'),
  ('지랄|염병|니미(?!츠)|느금|니애미|엠창|썅[년놈]?', '욕설'), ('미친[놈년]|또라이', '욕설'),
  ('\mfuck|\mshit\M|\mbitch|\masshole', '욕설'),
  ('짱[깨개]|쪽바리|쪽발이|깜둥이|똥남아|전라디언', '혐오'),
  ('김치녀|된장녀|한남충|한녀|틀딱|급식충|맘충|노인충|장애충|난민충|일베충|똥꼬충|개독|보슬아치|페미년', '혐오'),
  ('섹스|야동|포르노|떡치|따먹|꼴리|꼴린|ㅅㅅ하', '선정'), ('\mporn|\msex\M|\mnude\M', '선정')
on conflict (pattern) do nothing;

-- 검사할 글자: 제목·부제·본문(태그 뺀 글자)·기자명·태그·검색용 제목·설명 (없는 칸은 건너뛴다)
create or replace function public.article_moderation_text(j jsonb) returns text language sql immutable as $$
  select concat_ws(E'\n',
    j->>'title', j->>'excerpt',
    replace(regexp_replace(coalesce(j->>'body', ''), '<[^>]*>', ' ', 'g'), '&nbsp;', ' '),
    j->>'byline',
    (select string_agg(x, ',') from jsonb_array_elements_text(case when jsonb_typeof(j->'tags') = 'array' then j->'tags' else '[]'::jsonb end) x),
    j->>'meta_title', j->>'meta_description')
$$;

-- 걸린 금칙어 종류 (없으면 빈 배열). 서버의 발행 전 검사도 이 함수를 쓴다
create or replace function public.trial_word_hits(txt text) returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct kind order by kind), '{}') from trial_bad_words where txt ~* pattern
$$;
grant execute on function public.trial_word_hits(text) to authenticated;

-- 체험 기사 내용의 확인값 (서버가 검사를 마친 뒤 발행할 때 같이 넣는다)
create or replace function public.trial_content_hash(a uuid) returns text language sql stable security definer set search_path = public as $$
  select md5(public.article_moderation_text(to_jsonb(x))) from articles x where x.id = a and x.outlet_id = public.trial_outlet()
$$;
grant execute on function public.trial_content_hash(uuid) to authenticated;

create or replace function public.trial_moderation_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  hits text[];
  txt text;
  changed boolean;
begin
  if new.outlet_id is distinct from public.trial_outlet() then return new; end if;
  -- SQL 에디터(운영팀)·총관리자: 총관리자가 발행하면 보류가 풀린다
  if auth.uid() is null or public.is_super() then
    if new.status = 'published' then new.moderation_hold := false; end if;
    return new;
  end if;

  -- 보류는 총관리자만 풀 수 있다
  if tg_op = 'UPDATE' and old.moderation_hold and not new.moderation_hold then
    new.moderation_hold := true;
    new.moderation_note := old.moderation_note;
  end if;

  if new.status <> 'published' then return new; end if;
  txt := public.article_moderation_text(to_jsonb(new));
  changed := tg_op = 'INSERT' or old.status <> 'published'
    or txt is distinct from public.article_moderation_text(to_jsonb(old));
  if not changed then return new; end if;

  hits := public.trial_word_hits(txt);
  if array_length(hits, 1) > 0 then
    new.moderation_hold := true;
    new.moderation_note := '금칙어 검사: ' || array_to_string(hits, '·') || ' 표현';
  elsif not new.moderation_hold and new.moderation_hash is distinct from md5(txt) then
    new.moderation_hold := true;
    new.moderation_note := '발행 전 검사를 거치지 않았습니다';
  end if;
  if new.moderation_hold then
    new.status := 'in_review';
  end if;
  return new;
end $$;

drop trigger if exists zz_trial_moderation on articles;
create trigger zz_trial_moderation before insert or update on articles for each row execute function public.trial_moderation_guard();

-- 확인: 보류된 체험 기사
select a.title as "기사", a.moderation_note as "사유", a.updated_at as "수정"
from articles a where a.outlet_id = public.trial_outlet() and a.moderation_hold
order by a.updated_at desc;
