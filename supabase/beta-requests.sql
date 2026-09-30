-- IM 뉴스룸 제품 홈페이지: 베타 고객사 신청 (Supabase SQL 에디터에서 1회 실행)
-- 누구나 신청서를 넣을 수 있지만, 읽기는 관리자만 가능하다

create table if not exists beta_requests (
  id uuid primary key default gen_random_uuid(),
  company text not null check (char_length(company) between 1 and 80),
  contact_name text not null check (char_length(contact_name) between 1 and 40),
  phone text not null check (char_length(phone) between 7 and 30),
  email text check (email is null or char_length(email) <= 120),
  outlet_count text check (outlet_count is null or char_length(outlet_count) <= 20),
  current_cms text check (current_cms is null or char_length(current_cms) <= 80),
  message text check (message is null or char_length(message) <= 2000),
  agreed_at timestamptz not null,
  status text not null default 'new' check (status in ('new', 'contacted', 'done')),
  created_at timestamptz not null default now()
);

alter table beta_requests enable row level security;

drop policy if exists "beta_requests_insert" on beta_requests;
create policy "beta_requests_insert" on beta_requests for insert to anon, authenticated
  with check (status = 'new');

drop policy if exists "beta_requests_admin_read" on beta_requests;
create policy "beta_requests_admin_read" on beta_requests for select to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

drop policy if exists "beta_requests_admin_update" on beta_requests;
create policy "beta_requests_admin_update" on beta_requests for update to authenticated
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

-- 개인정보 보유기간(1년)이 지난 신청서는 매일 정리 (pg_cron이 켜져 있을 때)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('beta-requests-cleanup', '30 19 * * *',
      $job$ delete from public.beta_requests where created_at < now() - interval '1 year' $job$);
  end if;
end $$;
