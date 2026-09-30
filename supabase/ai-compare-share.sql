-- AI 모델 비교 결과를 링크로 공유하고, 받은 사람이 검토(가장 좋은 초안 고르기)를 남긴다
-- (Supabase SQL 에디터에서 실행, staff.sql 다음)
--   만들기·목록·삭제: IM 뉴스룸 운영팀(총관리자·매니저)만
--   링크를 받은 사람: 로그인 없이 결과를 보고 검토를 남길 수 있다 (아래 두 함수로만)

create table if not exists ai_compare_shares (
  id uuid primary key default gen_random_uuid(),
  token text not null unique check (char_length(token) >= 24),
  title text not null default 'AI 초안 비교' check (char_length(title) between 1 and 80),
  data jsonb not null check (octet_length(data::text) < 3000000),
  meta jsonb not null default '{}'::jsonb,   -- 목록용 요약: 모델 이름·보도자료 제목
  blind boolean not null default true,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days'
);

create table if not exists ai_compare_reviews (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references ai_compare_shares(id) on delete cascade,
  reviewer text not null check (char_length(reviewer) between 1 and 40),
  picks jsonb not null default '{}'::jsonb,   -- { 보도자료ID: 모델ID }
  notes jsonb not null default '{}'::jsonb,   -- { 보도자료ID: 한 줄 의견 }
  comment text check (comment is null or char_length(comment) <= 2000),
  created_at timestamptz not null default now()
);
alter table ai_compare_shares add column if not exists meta jsonb not null default '{}'::jsonb;
create index if not exists ai_compare_reviews_share on ai_compare_reviews(share_id);

alter table ai_compare_shares enable row level security;
alter table ai_compare_reviews enable row level security;

drop policy if exists "ai_compare_shares_staff" on ai_compare_shares;
create policy "ai_compare_shares_staff" on ai_compare_shares for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

drop policy if exists "ai_compare_reviews_staff_read" on ai_compare_reviews;
create policy "ai_compare_reviews_staff_read" on ai_compare_reviews for select to authenticated
  using (public.is_staff());

drop policy if exists "ai_compare_reviews_staff_delete" on ai_compare_reviews;
create policy "ai_compare_reviews_staff_delete" on ai_compare_reviews for delete to authenticated
  using (public.is_staff());

-- 링크로 열기: 기한이 지나지 않은 공유만
create or replace function public.ai_compare_share_get(p_token text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', s.id, 'title', s.title, 'data', s.data, 'blind', s.blind, 'created_at', s.created_at, 'expires_at', s.expires_at)
  from ai_compare_shares s
  where s.token = p_token and s.expires_at > now();
$$;

-- 검토 남기기: 링크 하나에 최대 100건, 고른 초안·의견 크기 제한
create or replace function public.ai_compare_review_submit(p_token text, p_reviewer text, p_picks jsonb, p_notes jsonb, p_comment text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  sid uuid;
  rid uuid;
begin
  select id into sid from ai_compare_shares where token = p_token and expires_at > now();
  if sid is null then raise exception '링크가 없거나 기한이 지났습니다.'; end if;
  if (select count(*) from ai_compare_reviews where share_id = sid) >= 100 then raise exception '이 링크로 받을 수 있는 검토 수를 넘었습니다.'; end if;
  if jsonb_typeof(coalesce(p_picks, '{}'::jsonb)) <> 'object' or jsonb_typeof(coalesce(p_notes, '{}'::jsonb)) <> 'object'
     or octet_length(coalesce(p_picks, '{}'::jsonb)::text) > 5000 or octet_length(coalesce(p_notes, '{}'::jsonb)::text) > 20000 then
    raise exception '검토 내용이 올바르지 않습니다.';
  end if;
  insert into ai_compare_reviews (share_id, reviewer, picks, notes, comment)
  values (sid, btrim(p_reviewer), coalesce(p_picks, '{}'::jsonb), coalesce(p_notes, '{}'::jsonb), nullif(btrim(coalesce(p_comment, '')), ''))
  returning id into rid;
  return rid;
end;
$$;

revoke all on function public.ai_compare_share_get(text) from public;
revoke all on function public.ai_compare_review_submit(text, text, jsonb, jsonb, text) from public;
grant execute on function public.ai_compare_share_get(text) to anon, authenticated;
grant execute on function public.ai_compare_review_submit(text, text, jsonb, jsonb, text) to anon, authenticated;

-- 기한 지난 공유는 매일 정리 (pg_cron이 켜져 있을 때)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('ai-compare-shares-cleanup', '40 19 * * *',
      $job$ delete from public.ai_compare_shares where expires_at < now() - interval '7 days' $job$);
  end if;
end $$;
