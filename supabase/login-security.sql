-- 로그인 기록 · 모든 기기에서 로그아웃 (Supabase SQL 에디터에서 실행, account-security.sql 다음. 여러 번 실행해도 된다)
--   1) 로그인 기록: 새로 로그인할 때마다(기기·브라우저마다) 시각·IP·브라우저를 남긴다. 1년 지난 기록은 지운다
--      본인은 내 정보에서, 발행인은 우리 그룹 기자·편집장, 총관리자는 모두 볼 수 있다
--   2) 모든 기기에서 로그아웃: 본인 또는 발행인·총관리자가 그 회원의 로그인을 한 번에 끊는다
--      끊긴 로그인은 그 즉시 편집국과 DB 자료를 열 수 없다 (session_ok 에 '살아 있는 로그인인가'를 더한다)
--   3) 장기 미접속: 회원 관리 화면에 1년 이상 접속하지 않은 회원을 따로 모아 보여주고, 한 번에 출입 정지한다 (총관리자는 탈퇴까지)
--   account-security.sql 을 다시 실행했다면 이 파일도 다시 실행해야 한다

create table if not exists login_events (
  id bigserial primary key,
  user_id uuid not null references profiles(id) on delete cascade,
  session_id uuid,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create unique index if not exists login_events_session on login_events (session_id) where session_id is not null;
create index if not exists login_events_user on login_events (user_id, created_at desc);
alter table login_events enable row level security;
drop policy if exists "login_events_select" on login_events;
create policy "login_events_select" on login_events for select to authenticated
  using (user_id = auth.uid() or public.is_super() or public.can_manage_member(user_id));

-- 지금 로그인이 자료를 열어도 되는가 (account-security.sql 의 같은 함수에 한 줄 더)
--   정지되지 않았고 / 2단계 인증을 켰다면 코드까지 넣었고 / 끊긴(로그아웃된) 로그인이 아닐 것
create or replace function public.session_ok() returns boolean language sql stable security definer set search_path = public, auth as $$
  select auth.uid() is null or (
    not exists (select 1 from profiles where id = auth.uid() and suspended_at is not null)
    and (coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2' or not public.mfa_enabled(auth.uid()))
    and (nullif(auth.jwt() ->> 'session_id', '') is null
         or exists (select 1 from auth.sessions s where s.id = (auth.jwt() ->> 'session_id')::uuid))
  );
$$;
grant execute on function public.session_ok() to authenticated, anon;

-- 새 로그인 남기기 (편집국 서버가 로그인마다 한 번 부른다)
create or replace function public.record_login(p_ip text, p_ua text) returns void
language plpgsql security definer set search_path = public as $$
declare sid uuid;
begin
  if auth.uid() is null or not exists (select 1 from profiles where id = auth.uid()) then return; end if;
  sid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  insert into login_events (user_id, session_id, ip, user_agent)
  values (auth.uid(), sid, left(nullif(trim(p_ip), ''), 64), left(nullif(trim(p_ua), ''), 300))
  on conflict (session_id) where session_id is not null do nothing;
  delete from login_events where user_id = auth.uid() and created_at < now() - interval '1 year';
end $$;
revoke all on function public.record_login(text, text) from public, anon;
grant execute on function public.record_login(text, text) to authenticated;

-- 로그인 기록 보기 (최근 것부터, 지금도 로그인돼 있는지 함께)
create or replace function public.login_history(target uuid, lim int default 30)
returns table (created_at timestamptz, ip text, user_agent text, session_id uuid, active boolean, current boolean)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if target is distinct from auth.uid() and not public.is_super() and not public.can_manage_member(target) then
    raise exception '이 회원의 로그인 기록을 볼 권한이 없습니다.';
  end if;
  return query
    select e.created_at, e.ip, e.user_agent, e.session_id,
           exists (select 1 from auth.sessions s where s.id = e.session_id),
           e.session_id is not distinct from nullif(auth.jwt() ->> 'session_id', '')::uuid
    from login_events e where e.user_id = target
    order by e.created_at desc limit greatest(1, least(lim, 100));
end $$;
revoke all on function public.login_history(uuid, int) from public, anon;
grant execute on function public.login_history(uuid, int) to authenticated;

-- 모든 기기에서 로그아웃 (본인 / 발행인은 우리 그룹 기자·편집장 / 총관리자는 모두). 끊은 로그인 수를 돌려준다
--   본인이 부르면 지금 쓰는 이 기기는 남긴다 (다른 기기만 끊는다)
create or replace function public.admin_signout_user(target uuid) returns integer
language plpgsql security definer set search_path = public, auth as $$
declare n integer;
begin
  if target is distinct from auth.uid() and not public.is_super() and not public.can_manage_member(target) then
    raise exception '이 회원의 로그인을 끊을 권한이 없습니다.';
  end if;
  delete from auth.sessions s
  where s.user_id = target
    and (target is distinct from auth.uid() or s.id is distinct from nullif(auth.jwt() ->> 'session_id', '')::uuid);
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function public.admin_signout_user(uuid) from public, anon;
grant execute on function public.admin_signout_user(uuid) to authenticated;

-- 회원별 마지막 접속 (회원 관리의 '최근 접속'과 '1년 이상 미접속 회원'에 쓴다)
--   마지막 로그인 · 로그인 유지 중 마지막 사용 · 로그인 기록 중 가장 늦은 때. 범위는 회원 관리와 같다 (총관리자 전체 / 발행인 우리 그룹)
do $$
declare trial_cond text := case when to_regprocedure('public.is_trial_user(uuid)') is not null
  then 'and (not public.is_trial_user(auth.uid()) or u.id = auth.uid())' else '' end;
begin
  execute format($f$
    create or replace function public.member_last_seen()
    returns table (id uuid, last_seen timestamptz)
    language plpgsql stable security definer set search_path = public, auth as $b$
    begin
      if not public.is_group_admin() then raise exception '발행인 또는 총관리자만 볼 수 있습니다.'; end if;
      return query
        select u.id, greatest(u.last_sign_in_at,
                              (select max(s.updated_at) from auth.sessions s where s.user_id = u.id),
                              (select max(e.created_at) from login_events e where e.user_id = u.id))
        from auth.users u
        where (public.is_super() or public.profile_publisher(u.id) = public.my_publisher()) %s;
    end $b$;
  $f$, trial_cond);
end $$;
revoke all on function public.member_last_seen() from public, anon;
grant execute on function public.member_last_seen() to authenticated;

-- 새 표에도 '정지·2단계 인증·끊긴 로그인' 확인을 겹쳐 건다 (account-security.sql 과 같은 방식)
do $$
declare t record;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format('drop policy if exists "zz_account_ok" on public.%I', t.relname);
    execute format('create policy "zz_account_ok" on public.%I as restrictive for all to authenticated using (public.session_ok()) with check (public.session_ok())', t.relname);
  end loop;
end $$;

-- 확인: 최근 로그인 기록
select p.full_name as "회원", e.created_at as "로그인", e.ip as "IP", left(e.user_agent, 60) as "브라우저"
from login_events e join profiles p on p.id = e.user_id
order by e.created_at desc limit 10;
