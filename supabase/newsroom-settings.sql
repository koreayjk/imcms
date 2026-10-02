-- 편집국 설정: 언론사 대표 이메일 · 기사 기자 이메일 · AI 법적 검수 결과 · 기자별 AI 사용량/한도
-- (Supabase SQL 에디터에서 실행, ai-usage.sql·outlet-members.sql 다음)

-- ───────── 1. 언론사 대표 이메일 (편집장·발행인이 바꾼다) ─────────
alter table outlets add column if not exists contact_email text
  check (contact_email is null or (char_length(contact_email) <= 120 and contact_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'));

-- outlets 수정은 운영팀만 가능하므로 이 칸만 바꾸는 함수를 둔다
create or replace function public.set_outlet_contact_email(o uuid, p_email text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(public.can_manage_outlet(o), false) and not coalesce(public.is_staff(), false) then
    raise exception '대표 이메일은 편집장·발행인만 바꿀 수 있습니다.';
  end if;
  update outlets set contact_email = nullif(lower(trim(p_email)), '') where id = o;
end $$;
revoke all on function public.set_outlet_contact_email(uuid, text) from public, anon;
grant execute on function public.set_outlet_contact_email(uuid, text) to authenticated;

-- ───────── 2. 기사의 기자 이메일 ─────────
--   기자: 언론사 대표 이메일로 고정 / 편집장 이상: 기사마다 바꿀 수 있다 (DB가 지킨다)
alter table articles add column if not exists byline_email text
  check (byline_email is null or char_length(byline_email) <= 120);

create or replace function articles_byline_email()
returns trigger as $$
begin
  if not coalesce(public.can_manage_outlet(new.outlet_id), false) and not coalesce(public.is_staff(), false) then
    -- 편집장이 정해 둔 값을 기자가 고칠 때는 그대로 두고, 그 밖에는 대표 이메일
    if tg_op = 'UPDATE' and new.byline_email is not distinct from old.byline_email then
      return new;
    end if;
    new.byline_email := (select contact_email from outlets where id = new.outlet_id);
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;
drop trigger if exists articles_byline_email on articles;
create trigger articles_byline_email before insert or update of byline_email, outlet_id on articles
  for each row execute function articles_byline_email();

-- ───────── 3. AI 법적 검수 결과 (승인신청·발행할 때 함께 저장) ─────────
alter table articles add column if not exists legal_check jsonb;
alter table articles add column if not exists legal_checked_at timestamptz;

-- ───────── 4. 기자별 AI 사용량·한도 ─────────
-- 사용 기록에 종류를 붙인다: draft(보도자료 AI 초안, 한도에 셈) / legal(법적 검수, 한도에 세지 않음)
alter table ai_usage add column if not exists kind text not null default 'draft' check (kind in ('draft', 'legal'));

-- 편집장이 정한 기자별 월 한도 (없으면 매체 한도를 인원수로 자동 배분)
create table if not exists ai_member_limits (
  outlet_id uuid not null references outlets(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  monthly_limit integer not null check (monthly_limit between 0 and 100000),
  updated_by uuid default auth.uid() references profiles(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (outlet_id, profile_id)
);
alter table ai_member_limits enable row level security;
drop policy if exists "ai_member_limits_read" on ai_member_limits;
create policy "ai_member_limits_read" on ai_member_limits for select to authenticated
  using (profile_id = auth.uid() or coalesce(public.can_manage_outlet(outlet_id), false) or coalesce(public.is_staff(), false));

-- 매체 구성원 (소속 목록 + 지금 이 매체로 일하는 사람). 운영팀 매니저는 빠진다
create or replace function public.outlet_member_ids(o uuid) returns setof uuid
language sql stable security definer set search_path = public as $$
  select m.profile_id from outlet_members m join profiles p on p.id = m.profile_id
  where m.outlet_id = o and not (coalesce(p.is_staff, false) and not coalesce(p.is_super, false))
  union
  select p.id from profiles p
  where p.outlet_id = o and coalesce(p.approved, true) and not (coalesce(p.is_staff, false) and not coalesce(p.is_super, false));
$$;

-- 한 사람의 이번 달 한도 (null = 한도 없음)
--   편집장이 정한 값이 있으면 그 값, 없으면 (매체 한도 − 따로 정한 사람들 몫) ÷ 나머지 인원
create or replace function public.ai_member_limit_of(o uuid, uid uuid) returns integer
language plpgsql stable security definer set search_path = public as $$
declare
  custom integer;
  lim integer;
  fixed_sum integer;
  n_auto integer;
begin
  select monthly_limit into custom from ai_member_limits where outlet_id = o and profile_id = uid;
  if custom is not null then return custom; end if;
  lim := public.ai_limit_of(o);
  if lim is null then return null; end if;
  if not exists (select 1 from public.outlet_member_ids(o) m where m = uid) then return null; end if;
  select coalesce(sum(l.monthly_limit), 0) into fixed_sum
  from ai_member_limits l where l.outlet_id = o and l.profile_id in (select public.outlet_member_ids(o));
  select count(*) into n_auto from public.outlet_member_ids(o) m
  where not exists (select 1 from ai_member_limits l where l.outlet_id = o and l.profile_id = m);
  return floor(greatest(0, lim - fixed_sum)::numeric / greatest(1, n_auto))::integer;
end $$;

-- 이번 달 사용 현황 (보도자료·뉴스룸 화면용): 매체 전체 + 내 몫
create or replace function public.ai_usage_status(o uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  lim integer;
  used integer;
  ov boolean;
  pl text;
  my_used integer;
  my_lim integer;
begin
  if o is null or not coalesce(public.can_view_outlet(o), false) then return null; end if;
  select plan, ai_overage into pl, ov from outlets where id = o;
  lim := public.ai_limit_of(o);
  select count(*) into used from ai_usage where outlet_id = o and kind = 'draft' and created_at >= public.kst_month_start();
  select count(*) into my_used from ai_usage where outlet_id = o and user_id = auth.uid() and kind = 'draft' and created_at >= public.kst_month_start();
  my_lim := public.ai_member_limit_of(o, auth.uid());
  return jsonb_build_object('plan', pl, 'limit', lim, 'used', used, 'overage', coalesce(ov, false),
    'over', greatest(0, used - coalesce(lim, used)), 'mine_used', my_used, 'mine_limit', my_lim);
end $$;

-- AI 초안 한 건 잡기: 내 한도 → 매체 한도 순서로 본다
create or replace function public.ai_usage_reserve(o uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  lim integer;
  used integer;
  ov boolean;
  new_id bigint;
  is_over boolean;
  my_used integer;
  my_lim integer;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if not coalesce(public.can_view_outlet(o), false) then raise exception '이 매체에서 AI 초안을 쓸 권한이 없습니다.'; end if;
  perform pg_advisory_xact_lock(hashtext('ai_usage:' || o::text));
  my_lim := public.ai_member_limit_of(o, auth.uid());
  select count(*) into my_used from ai_usage where outlet_id = o and user_id = auth.uid() and kind = 'draft' and created_at >= public.kst_month_start();
  if my_lim is not null and my_used >= my_lim then
    return jsonb_build_object('ok', false, 'scope', 'member', 'used', my_used, 'limit', my_lim);
  end if;
  lim := public.ai_limit_of(o);
  select coalesce(ai_overage, false) into ov from outlets where id = o;
  select count(*) into used from ai_usage where outlet_id = o and kind = 'draft' and created_at >= public.kst_month_start();
  is_over := lim is not null and used >= lim;
  if is_over and not ov then
    return jsonb_build_object('ok', false, 'scope', 'outlet', 'used', used, 'limit', lim);
  end if;
  insert into ai_usage (outlet_id, user_id, over_limit, kind) values (o, auth.uid(), is_over, 'draft') returning id into new_id;
  return jsonb_build_object('ok', true, 'id', new_id, 'used', used + 1, 'limit', lim, 'over_limit', is_over, 'mine_used', my_used + 1, 'mine_limit', my_lim);
end $$;

-- AI 법적 검수 기록 (한도에 세지 않는다. 기자별 사용 횟수에만 보인다)
create or replace function public.ai_usage_log(o uuid, p_kind text, m text, tin integer, tout integer, cost numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or o is null or not coalesce(public.can_view_outlet(o), false) then return; end if;
  if p_kind <> 'legal' then raise exception '지원하지 않는 기록입니다.'; end if;
  insert into ai_usage (outlet_id, user_id, kind, model, input_tokens, output_tokens, cost_usd, done)
  values (o, auth.uid(), 'legal', left(m, 60), tin, tout, cost, true);
end $$;

-- 기자별 이번 달 사용량 (편집장 이상은 모두, 기자는 자기 줄만)
create or replace function public.ai_member_usage(o uuid)
returns table (profile_id uuid, full_name text, role text, drafts integer, legal_checks integer, custom_limit integer, effective_limit integer)
language plpgsql stable security definer set search_path = public as $$
declare manager boolean := coalesce(public.can_manage_outlet(o), false) or coalesce(public.is_staff(), false);
begin
  if not coalesce(public.can_view_outlet(o), false) then return; end if;
  return query
    select p.id, p.full_name,
      coalesce((select m.role from outlet_members m where m.profile_id = p.id and m.outlet_id = o), p.role::text),
      (select count(*)::integer from ai_usage u where u.outlet_id = o and u.user_id = p.id and u.kind = 'draft' and u.created_at >= public.kst_month_start()),
      (select count(*)::integer from ai_usage u where u.outlet_id = o and u.user_id = p.id and u.kind = 'legal' and u.created_at >= public.kst_month_start()),
      (select l.monthly_limit from ai_member_limits l where l.outlet_id = o and l.profile_id = p.id),
      public.ai_member_limit_of(o, p.id)
    from profiles p
    where p.id in (select public.outlet_member_ids(o)) and (manager or p.id = auth.uid())
    order by p.full_name;
end $$;

-- 편집장: 기자별 한도 정하기 (null 이면 자동 배분으로 되돌린다)
create or replace function public.set_member_ai_limit(o uuid, member uuid, lim integer) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not coalesce(public.can_manage_outlet(o), false) and not coalesce(public.is_staff(), false) then
    raise exception '기자별 AI 한도는 편집장·발행인만 정할 수 있습니다.';
  end if;
  if not exists (select 1 from public.outlet_member_ids(o) m where m = member) then raise exception '이 매체의 구성원이 아닙니다.'; end if;
  if lim is null then
    delete from ai_member_limits where outlet_id = o and profile_id = member;
  else
    if lim < 0 or lim > 100000 then raise exception '한도는 0 이상의 숫자로 정해 주세요.'; end if;
    insert into ai_member_limits (outlet_id, profile_id, monthly_limit) values (o, member, lim)
    on conflict (outlet_id, profile_id) do update set monthly_limit = excluded.monthly_limit, updated_by = auth.uid(), updated_at = now();
  end if;
end $$;

-- 운영팀 개요: AI 초안만 센다 (법적 검수는 빼고)
create or replace function public.ai_usage_overview() returns table (outlet_id uuid, outlet_name text, plan text, lim integer, used integer, over_count integer, overage boolean, cost_usd numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not coalesce(public.is_staff(), false) then raise exception '운영팀만 볼 수 있습니다.'; end if;
  return query
    select o.id, o.name, o.plan, public.ai_limit_of(o.id),
      count(u.id) filter (where u.kind = 'draft')::integer, count(u.id) filter (where u.over_limit and u.kind = 'draft')::integer, o.ai_overage, coalesce(sum(u.cost_usd), 0)
    from outlets o
    left join ai_usage u on u.outlet_id = o.id and u.created_at >= public.kst_month_start()
    group by o.id order by count(u.id) desc, o.name;
end $$;

-- 내부 계산용 함수는 직접 부를 수 없게
revoke all on function public.outlet_member_ids(uuid), public.ai_member_limit_of(uuid, uuid) from public, anon, authenticated;
revoke all on function public.ai_usage_log(uuid, text, text, integer, integer, numeric), public.ai_member_usage(uuid), public.set_member_ai_limit(uuid, uuid, integer) from public, anon;
grant execute on function public.ai_usage_log(uuid, text, text, integer, integer, numeric), public.ai_member_usage(uuid), public.set_member_ai_limit(uuid, uuid, integer),
  public.ai_usage_status(uuid), public.ai_usage_reserve(uuid) to authenticated;
