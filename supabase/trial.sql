-- IM 뉴스룸 체험판 (Supabase SQL 에디터에서 실행. groups.sql·staff.sql·signup-outlet.sql·newsroom-settings.sql·outlet-sites.sql 다음. 여러 번 실행해도 된다)
--   체험 전용 언론사 'IM 체험뉴스' 하나를 모두가 같이 쓴다
--   1) 체험신문·체험 그룹 + 섹션 + 샘플 기사 (우리 매체 최근 기사 복사, 수정·삭제 불가)
--   2) 체험 가입: 가입하면 바로 체험신문 기자로 승인, 7일 동안 사용. AI는 1인 30회
--   3) 체험 중에는 기자·편집장·그룹장 역할을 바꿔 가며 쓸 수 있다
--   4) 보호: 샘플 기사 수정·삭제 금지, 다른 사람 기사 삭제 금지, 다른 회원 정보·섹션·AI 한도·초대 변경 금지
--   5) 매일 새벽 정리: 7일 지난 체험 기사·3일 지난 체험 광고 삭제, 홈 편집판 초기화, 끝난 지 30일 지난 체험 계정 삭제

-- 0) 칸
alter table profiles add column if not exists trial_until timestamptz;
alter table articles add column if not exists is_sample boolean not null default false;

-- 체험 신청자 (영업용 기록. 계정을 지워도 남는다)
create table if not exists trial_signups (
  user_id uuid primary key,
  email text,
  name text,
  company text,
  position text,
  phone text,
  agreed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table trial_signups enable row level security;
drop policy if exists "trial_signups_staff" on trial_signups;
create policy "trial_signups_staff" on trial_signups for select to authenticated using (public.is_staff());

-- 1) 체험신문·체험 그룹·섹션
do $$
declare g uuid; o uuid;
begin
  select id into o from outlets where site->>'trial' = 'true' limit 1;
  if o is null then
    insert into publishers (name, solo) values ('IM 체험 그룹', false) returning id into g;
    insert into outlets (name, domain, publisher_id, site, ai_monthly_limit)
    values ('IM 체험뉴스', 'imnews-demo.vercel.app', g, jsonb_build_object(
      'trial', true,
      'nameEn', 'IM DEMO NEWS',
      'slogan', 'IM 뉴스룸으로 만든 체험용 신문',
      'sloganEn', 'TRY IM NEWSROOM',
      'description', 'IM 뉴스룸 체험용 홈페이지입니다. 기사는 샘플이거나 체험 중인 분들이 쓴 연습 기사입니다.',
      'specialtyTitle', '샘플 전문뉴스',
      'logoMode', 'text',
      'indexable', false,
      'colors', jsonb_build_object('brand', '#1F3A5F', 'accent', '#C9A227'),
      'legal', jsonb_build_object('company', 'IM 뉴스룸 체험판', 'email', '')
    ), 100000) returning id into o;
  end if;
  insert into categories (outlet_id, name, slug, sort_order)
  select o, x.name, x.slug, x.ord from (values
    ('경제', 'economy', 1), ('산업', 'industry', 2), ('국제', 'world', 3),
    ('건강·복지', 'health', 4), ('사회', 'society', 5), ('문화', 'culture', 6)
  ) as x(name, slug, ord)
  where not exists (select 1 from categories c where c.outlet_id = o and c.slug = x.slug);
end $$;

create or replace function public.trial_outlet() returns uuid language sql stable security definer set search_path = public as $$
  select id from outlets where site->>'trial' = 'true' order by created_at limit 1;
$$;
grant execute on function public.trial_outlet() to anon, authenticated;

-- 체험 중인 계정인지 (기간이 끝났어도 체험 계정이면 true)
create or replace function public.is_trial_user(uid uuid default auth.uid()) returns boolean language sql stable security definer set search_path = public as $$
  select uid is not null and exists (select 1 from profiles where id = uid and trial_until is not null);
$$;
grant execute on function public.is_trial_user(uuid) to authenticated;

-- 샘플 기사: 우리 매체의 최근 발행 기사를 복사 (체험신문에 샘플이 없을 때만)
do $$
declare o uuid := public.trial_outlet();
begin
  if o is null or exists (select 1 from articles where outlet_id = o and is_sample) then return; end if;
  with src as (
    select a.*, so.name as src_outlet, c.slug as src_slug,
           row_number() over (partition by a.outlet_id order by a.published_at desc) as n
    from articles a
    join outlets so on so.id = a.outlet_id
    left join categories c on c.id = a.category_id
    where so.name in ('더케어타임즈', 'Shipping Times', 'Israel Today')
      and a.status = 'published' and a.published_at <= now()
      and a.thumbnail_url is not null and a.source_article_id is null
  ), picked as (
    select s.*,
      case
        when s.src_outlet = '더케어타임즈' then case when s.src_slug in ('politics', 'society') then 'society' when s.src_slug = 'economy' then 'economy' when s.src_slug = 'culture' then 'culture' else 'health' end
        when s.src_outlet = 'Shipping Times' then case when s.n % 2 = 0 then 'industry' else 'economy' end
        else case when s.src_slug ~ '(culture|holy|art|video)' then 'culture' else 'world' end
      end as slug
    from src s where s.n <= 12
  )
  insert into articles (outlet_id, category_id, author_id, title, excerpt, body, thumbnail_url, tags, status, published_at, byline, is_sample)
  select o, (select id from categories where outlet_id = o and slug = p.slug), p.author_id, p.title, p.excerpt, p.body, p.thumbnail_url, p.tags,
         'published', p.published_at, '샘플 기자', true
  from picked p;
end $$;

-- 2) 체험 가입: 회원가입 때 data.site = 'trial' 이면 체험신문 기자로 바로 승인 (편집국 가입 트리거 다음에 돈다)
create or replace function public.trial_handle_signup()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  o uuid;
begin
  if m->>'site' is distinct from 'trial' then return new; end if;
  o := public.trial_outlet();
  if o is null then return new; end if;
  update profiles set
    outlet_id = o, approved = true, role = 'reporter', publisher_id = null, requested_outlet_id = null,
    trial_until = now() + interval '7 days',
    full_name = left(coalesce(nullif(trim(m->>'full_name'), ''), split_part(new.email, '@', 1)), 30)
  where id = new.id;
  insert into ai_member_limits (outlet_id, profile_id, monthly_limit) values (o, new.id, 30)
  on conflict (outlet_id, profile_id) do update set monthly_limit = 30;
  insert into trial_signups (user_id, email, name, company, position, phone, agreed_at)
  values (new.id, new.email, left(m->>'full_name', 30), left(m->>'company', 80), left(m->>'position', 40), left(m->>'phone', 30),
          coalesce(nullif(m->>'agreed_at', '')::timestamptz, now()))
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists zz_trial_signup on auth.users;
create trigger zz_trial_signup after insert on auth.users for each row execute function public.trial_handle_signup();

-- 3) 역할 바꾸기: reporter(기자) / editor(편집장) / group(그룹장 = 체험 그룹 발행인)
create or replace function public.trial_switch_role(r text)
returns void language plpgsql security definer set search_path = public as $$
declare
  me profiles%rowtype;
  o uuid := public.trial_outlet();
  g uuid;
  claims text;
  sub text;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null or me.trial_until is null then raise exception '체험 계정만 역할을 바꿀 수 있습니다.'; end if;
  if me.trial_until < now() then raise exception '체험 기간이 끝났습니다.'; end if;
  if r not in ('reporter', 'editor', 'group') then raise exception '없는 역할입니다.'; end if;
  select publisher_id into g from outlets where id = o;
  -- 권한 보호 트리거(protect_profile_fields)는 로그인 사용자의 권한 변경을 막으므로, 이 한 번의 변경만 로그인 정보 없이 처리한다
  claims := current_setting('request.jwt.claims', true);
  sub := current_setting('request.jwt.claim.sub', true);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  update profiles set
    role = (case r when 'reporter' then 'reporter' when 'editor' then 'editor' else 'admin' end)::user_role,
    publisher_id = case when r = 'group' then g else null end,
    outlet_id = o
  where id = me.id;
  perform set_config('request.jwt.claims', coalesce(claims, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(sub, ''), true);
end $$;
revoke all on function public.trial_switch_role(text) from public, anon;
grant execute on function public.trial_switch_role(text) to authenticated;

-- 4) 보호
-- 기사: 샘플은 누구도(운영팀 제외) 고치거나 지울 수 없다. 체험 계정은 본인 기사만 지운다. 기간이 끝나면 쓰기 금지
create or replace function public.trial_article_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  until timestamptz;
begin
  if uid is null or coalesce(public.is_staff(), false) then return coalesce(new, old); end if;
  if tg_op <> 'INSERT' and coalesce(old.is_sample, false) then
    if tg_op = 'DELETE' then
      raise exception '체험용 샘플 기사는 지울 수 없습니다. 직접 쓴 기사로 체험해 주세요.';
    end if;
    if (to_jsonb(new) - array['view_count', 'updated_at']) is distinct from (to_jsonb(old) - array['view_count', 'updated_at']) then
      raise exception '체험용 샘플 기사는 고칠 수 없습니다. 새 기사를 써서 체험해 주세요.';
    end if;
  end if;
  select trial_until into until from profiles where id = uid;
  if until is not null then
    if until < now() then raise exception '체험 기간이 끝났습니다. 정식 신청 후 이어서 쓸 수 있습니다.'; end if;
    if tg_op = 'DELETE' and old.author_id is distinct from uid then
      raise exception '체험에서는 본인이 쓴 기사만 지울 수 있습니다.';
    end if;
    if tg_op = 'INSERT' then new.is_sample := false; end if;
    if tg_op = 'UPDATE' and new.is_sample is distinct from old.is_sample then new.is_sample := old.is_sample; end if;
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists trial_article_guard on articles;
create trigger trial_article_guard before insert or update or delete on articles for each row execute function public.trial_article_guard();

-- 회원: 체험 계정은 다른 회원을 바꾸거나 지울 수 없고, 자기 체험 기간도 바꿀 수 없다
create or replace function public.trial_profile_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or coalesce(public.is_staff(), false) then return coalesce(new, old); end if;
  if tg_op = 'UPDATE' and new.trial_until is distinct from old.trial_until then
    raise exception '체험 기간은 운영팀만 바꿀 수 있습니다.';
  end if;
  if public.is_trial_user(uid) and coalesce(old.id, new.id) <> uid then
    raise exception '체험 계정에서는 다른 회원의 정보를 바꿀 수 없습니다.';
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists trial_profile_guard on profiles;
create trigger trial_profile_guard before update or delete on profiles for each row execute function public.trial_profile_guard();

-- 섹션·AI 한도·초대·뉴스레터 구독자: 체험 계정은 보기만
create or replace function public.trial_readonly_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_trial_user(auth.uid()) and not coalesce(public.is_staff(), false) then
    raise exception '체험 계정에서는 %', tg_argv[0];
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists trial_guard on categories;
create trigger trial_guard before insert or update or delete on categories for each row execute function public.trial_readonly_guard('섹션을 바꿀 수 없습니다. 정식 이용 때 자유롭게 바꿀 수 있습니다.');
drop trigger if exists trial_guard on ai_member_limits;
create trigger trial_guard before insert or update or delete on ai_member_limits for each row execute function public.trial_readonly_guard('AI 한도를 바꿀 수 없습니다.');
drop trigger if exists trial_guard on invitations;
create trigger trial_guard before insert or update or delete on invitations for each row execute function public.trial_readonly_guard('회원을 초대할 수 없습니다. 정식 이용 때 기자를 초대할 수 있습니다.');
drop trigger if exists trial_guard on newsletter_subscribers;
create trigger trial_guard before insert or update or delete on newsletter_subscribers for each row execute function public.trial_readonly_guard('뉴스레터 구독자를 바꿀 수 없습니다.');

-- 매체별 소속(outlet_members)도 체험 계정은 바꿀 수 없다
do $$
begin
  if to_regclass('public.outlet_members') is not null then
    drop trigger if exists trial_guard on outlet_members;
    create trigger trial_guard before insert or update or delete on outlet_members for each row execute function public.trial_readonly_guard('회원 소속을 바꿀 수 없습니다.');
  end if;
end $$;

-- 회원 관리 화면: 체험 그룹장에게는 다른 체험자의 이메일을 보여주지 않고, 가입 거절도 못 하게 한다
--   (signup-outlet.sql 의 같은 함수에 체험 조건만 더한 것. signup-outlet.sql 을 다시 실행했다면 이 파일도 다시 실행)
create or replace function public.admin_list_users()
returns table (id uuid, email text, provider text, last_sign_in_at timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_group_admin() then raise exception '발행인 또는 총관리자만 볼 수 있습니다.'; end if;
  return query
    select u.id, u.email::text, coalesce(u.raw_app_meta_data->>'provider', 'email'), u.last_sign_in_at
    from auth.users u
    where (public.is_super() or public.profile_publisher(u.id) = public.my_publisher() or public.pending_publisher(u.id) = public.my_publisher())
      and (not public.is_trial_user(auth.uid()) or u.id = auth.uid());
end $$;

create or replace function public.admin_reject_user(target uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if public.is_trial_user(auth.uid()) then raise exception '체험 계정에서는 가입 신청을 처리할 수 없습니다.'; end if;
  -- 값이 비면(null) 조건 전체가 null이 되어 통과되지 않도록 coalesce로 거짓 처리
  if not coalesce(public.is_super() or (public.is_group_admin() and public.pending_publisher(target) = public.my_publisher()), false) then
    raise exception '이 가입 신청을 거절할 권한이 없습니다.';
  end if;
  if target = auth.uid() or exists (select 1 from profiles where id = target and (approved or role = 'admin' or is_super)) then
    raise exception '승인 대기 중인 계정만 거절할 수 있습니다.';
  end if;
  delete from auth.users where id = target;
end $$;

-- 5) 매일 새벽 정리
create or replace function public.trial_cleanup()
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare
  o uuid := public.trial_outlet();
  n_articles int := 0;
  n_ads int := 0;
  n_users int := 0;
  u record;
begin
  if o is null then return jsonb_build_object('skipped', 'no trial outlet'); end if;
  delete from articles where outlet_id = o and not is_sample and created_at < now() - interval '7 days';
  get diagnostics n_articles = row_count;
  delete from ad_banners where outlet_id = o and created_at < now() - interval '3 days';
  get diagnostics n_ads = row_count;
  delete from home_layouts where outlet_id = o;
  -- 상담 기록은 신청일로부터 1년
  delete from trial_signups where created_at < now() - interval '1 year';
  for u in select id from profiles where trial_until is not null and trial_until < now() - interval '30 days' loop
    begin
      delete from articles where author_id = u.id and not is_sample;
      update articles set author_id = (select author_id from articles where outlet_id = o and is_sample limit 1) where author_id = u.id;
      update articles set reviewed_by = null where reviewed_by = u.id;
      update home_layouts set updated_by = null where updated_by = u.id;
      delete from auth.users where id = u.id;
      n_users := n_users + 1;
    exception when others then
      raise notice 'trial user % not deleted: %', u.id, sqlerrm;
    end;
  end loop;
  return jsonb_build_object('articles', n_articles, 'ads', n_ads, 'users', n_users);
end $$;
revoke all on function public.trial_cleanup() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'trial-cleanup';
    -- 매일 새벽 4시(한국)
    perform cron.schedule('trial-cleanup', '0 19 * * *', 'select public.trial_cleanup()');
  else
    raise notice '예약 작업(pg_cron)이 없어 매일 정리는 켜지 않았습니다. 필요할 때 select public.trial_cleanup(); 을 실행하세요.';
  end if;
end $$;

-- 결과
select o.name as "체험신문", o.domain as "주소", (select count(*) from articles a where a.outlet_id = o.id and a.is_sample) as "샘플 기사"
from outlets o where o.id = public.trial_outlet();
