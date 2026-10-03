-- 글로벌디지털언론협회(GDPA) 사이트 (Supabase SQL 에디터에서 실행, groups.sql·signup-outlet.sql 다음. 여러 번 실행해도 된다)
--   1) 협회 회원사: IM 뉴스룸 매체 중 협회에 가입한 매체 (처음에는 더케어타임즈·Shipping Times·Israel Today)
--   2) 협회 회원: 협회 사이트에서 가입한 사람 (이용약관·개인정보 동의 시각을 남긴다). 사무국이 승인한다
--   3) 협회 게시글: 공지사항·협회 활동·자료실
--   협회 사이트로 가입한 계정은 편집국 회원(기자) 승인 목록에 나오지 않는다

-- 1) 회원사
create table if not exists gdpa_member_outlets (
  outlet_id uuid primary key references outlets(id) on delete cascade,
  sort_order int not null default 0,
  joined_on date not null default current_date,
  intro text
);
alter table gdpa_member_outlets enable row level security;
drop policy if exists "gdpa_member_outlets_read" on gdpa_member_outlets;
create policy "gdpa_member_outlets_read" on gdpa_member_outlets for select to anon, authenticated using (true);
drop policy if exists "gdpa_member_outlets_staff" on gdpa_member_outlets;
create policy "gdpa_member_outlets_staff" on gdpa_member_outlets for all to authenticated using (public.is_staff()) with check (public.is_staff());

insert into gdpa_member_outlets (outlet_id, sort_order, intro)
select o.id, x.ord, x.intro
from (values
  ('더케어타임즈', 1, '보건·복지, 병원·의료, 요양·시니어케어, 돌봄산업 전문 인터넷신문'),
  ('Shipping Times', 2, '해운·항만·항공화물·포워딩·무역 전문 국제물류 미디어'),
  ('Israel Today', 3, '이스라엘 현지 소식과 성경·쉐마 교육을 전하는 기독교 전문 미디어')
) as x(name, ord, intro)
join outlets o on o.name = x.name
on conflict (outlet_id) do nothing;

-- 2) 협회 회원
create table if not exists gdpa_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  phone text,
  org text,
  position text,
  member_type text not null default 'individual' check (member_type in ('individual', 'outlet')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  agreed_terms_at timestamptz not null,
  agreed_privacy_at timestamptz not null,
  marketing boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table gdpa_members enable row level security;
drop policy if exists "gdpa_members_own" on gdpa_members;
create policy "gdpa_members_own" on gdpa_members for select to authenticated using (user_id = auth.uid() or public.is_staff());
drop policy if exists "gdpa_members_staff" on gdpa_members;
create policy "gdpa_members_staff" on gdpa_members for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- 본인: 가입 신청(이미 로그인한 편집국 회원이 협회에도 가입할 때)·연락처 고치기. 승인 상태는 바꿀 수 없다
create or replace function public.gdpa_join(p_name text, p_phone text, p_org text, p_position text, p_type text, p_marketing boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  insert into gdpa_members (user_id, name, phone, org, position, member_type, agreed_terms_at, agreed_privacy_at, marketing)
  values (auth.uid(), left(trim(p_name), 40), left(trim(p_phone), 30), left(trim(p_org), 80), left(trim(p_position), 40),
          case when p_type = 'outlet' then 'outlet' else 'individual' end, now(), now(), coalesce(p_marketing, false))
  on conflict (user_id) do update set
    name = excluded.name, phone = excluded.phone, org = excluded.org, position = excluded.position,
    member_type = excluded.member_type, marketing = excluded.marketing, updated_at = now();
end $$;
revoke all on function public.gdpa_join(text, text, text, text, text, boolean) from public, anon;
grant execute on function public.gdpa_join(text, text, text, text, text, boolean) to authenticated;

-- 협회 사이트에서 가입한 계정: 협회 회원으로 등록하고, 편집국 가입 트리거가 만든 '승인 대기 기자' 행은 지운다
--   (이 트리거는 이름순으로 편집국 트리거(on_auth_user_created) 다음에 돈다)
create or replace function public.gdpa_handle_signup()
returns trigger language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  if m->>'site' is distinct from 'gdpa' then return new; end if;
  insert into gdpa_members (user_id, name, phone, org, position, member_type, agreed_terms_at, agreed_privacy_at, marketing)
  values (
    new.id,
    left(coalesce(nullif(trim(m->>'name'), ''), split_part(new.email, '@', 1)), 40),
    left(nullif(trim(m->>'phone'), ''), 30),
    left(nullif(trim(m->>'org'), ''), 80),
    left(nullif(trim(m->>'position'), ''), 40),
    case when m->>'member_type' = 'outlet' then 'outlet' else 'individual' end,
    coalesce(nullif(m->>'agreed_terms_at', '')::timestamptz, now()),
    coalesce(nullif(m->>'agreed_privacy_at', '')::timestamptz, now()),
    coalesce((m->>'marketing')::boolean, false)
  )
  on conflict (user_id) do nothing;
  delete from profiles p where p.id = new.id and coalesce(p.approved, false) = false
    and p.outlet_id is null and p.publisher_id is null and not coalesce(p.is_super, false);
  return new;
end $$;
drop trigger if exists zz_gdpa_signup on auth.users;
create trigger zz_gdpa_signup after insert on auth.users for each row execute function public.gdpa_handle_signup();

-- 3) 게시글: 공지사항(notice) · 협회 활동(activity) · 자료실(data)
create table if not exists gdpa_posts (
  id uuid primary key default gen_random_uuid(),
  board text not null check (board in ('notice', 'activity', 'data')),
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '',
  pinned boolean not null default false,
  published boolean not null default true,
  author_id uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists gdpa_posts_board on gdpa_posts (board, pinned desc, created_at desc);
alter table gdpa_posts enable row level security;
drop policy if exists "gdpa_posts_read" on gdpa_posts;
create policy "gdpa_posts_read" on gdpa_posts for select to anon, authenticated using (published or public.is_staff());
drop policy if exists "gdpa_posts_staff" on gdpa_posts;
create policy "gdpa_posts_staff" on gdpa_posts for all to authenticated using (public.is_staff()) with check (public.is_staff());

-- 첫 공지
insert into gdpa_posts (board, title, body, pinned)
select 'notice', '글로벌디지털언론협회(GDPA) 홈페이지를 열었습니다',
  E'글로벌디지털언론협회(GDPA) 홈페이지를 열었습니다.\n\n협회는 디지털 시대에 맞는 책임 있는 저널리즘과 회원사 간 협력을 위해 출범을 준비하고 있습니다. 회원사 소식과 협회 활동은 이 홈페이지에서 안내해 드리겠습니다.\n\n회원 가입과 회원사 입회 문의는 홈페이지의 회원가입·입회 안내를 참고해 주세요.',
  true
where not exists (select 1 from gdpa_posts where board = 'notice');

-- 4) 운영팀 화면: 협회 회원 목록 (이메일은 로그인 정보에만 있어 함수로 꺼낸다)
create or replace function public.gdpa_member_list()
returns table (user_id uuid, email text, name text, phone text, org text, "position" text, member_type text, status text, marketing boolean, created_at timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not coalesce(public.is_staff(), false) then raise exception '운영팀만 볼 수 있습니다.'; end if;
  return query
    select m.user_id, u.email::text, m.name, m.phone, m.org, m.position, m.member_type, m.status, m.marketing, m.created_at
    from gdpa_members m join auth.users u on u.id = m.user_id
    order by (m.status = 'pending') desc, m.created_at desc;
end $$;
revoke all on function public.gdpa_member_list() from public, anon;
grant execute on function public.gdpa_member_list() to authenticated;
