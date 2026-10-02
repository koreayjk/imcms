-- 광고 배너 (Supabase SQL 에디터에서 실행, groups.sql·staff.sql 다음)
--   매체 홈페이지의 정해진 자리(상단 띠·오른쪽·홈 중간·기사 아래·첫 화면 팝업)에 광고를 건다
--   이미지 배너: 그 매체의 편집장·발행인이 직접 올리고 기간을 정한다
--   광고 코드(구글 애드센스·카카오 애드핏 등 스크립트): 홈페이지에 그대로 실행되므로 IM 뉴스룸 운영팀만 넣는다 (업무요청으로 요청)
--   노출·클릭은 하루 단위로 센다 (검색 로봇 제외)

create table if not exists ad_banners (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  slot text not null check (slot in ('header', 'sidebar', 'home_middle', 'article_bottom', 'popup')),
  kind text not null default 'image' check (kind in ('image', 'code')),
  -- 광고주·광고 이름 (편집국에서 알아보기 위한 이름, 이미지 대체 글자로도 쓴다)
  name text not null check (char_length(name) between 1 and 80),
  image_url text check (image_url is null or (char_length(image_url) <= 1000 and image_url ~* '^https?://')),
  -- 휴대폰용 이미지 (없으면 PC 이미지)
  mobile_image_url text check (mobile_image_url is null or (char_length(mobile_image_url) <= 1000 and mobile_image_url ~* '^https?://')),
  link_url text check (link_url is null or (char_length(link_url) <= 1000 and link_url ~* '^https?://')),
  code text check (code is null or char_length(code) <= 20000),
  starts_at timestamptz,
  ends_at timestamptz,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_by uuid default auth.uid() references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'image' and image_url is not null) or (kind = 'code' and code is not null)),
  check (ends_at is null or starts_at is null or ends_at > starts_at)
);
create index if not exists ad_banners_outlet_slot on ad_banners(outlet_id, slot);

create table if not exists ad_stats (
  banner_id uuid not null references ad_banners(id) on delete cascade,
  day date not null,
  views integer not null default 0,
  clicks integer not null default 0,
  primary key (banner_id, day)
);

-- 지금 홈페이지에 나가는 배너인가 (켜져 있고 기간 안)
create or replace function public.ad_is_live(b ad_banners) returns boolean language sql stable as $$
  select b.active and (b.starts_at is null or b.starts_at <= now()) and (b.ends_at is null or b.ends_at > now());
$$;

alter table ad_banners enable row level security;
alter table ad_stats enable row level security;

-- 보기: 누구나 지금 나가는 배너 / 편집국은 우리 매체 배너 전체 / 운영팀은 전부
drop policy if exists "ad_banners_public" on ad_banners;
create policy "ad_banners_public" on ad_banners for select to anon, authenticated
  using (active and (starts_at is null or starts_at <= now()) and (ends_at is null or ends_at > now()));
drop policy if exists "ad_banners_manage_read" on ad_banners;
create policy "ad_banners_manage_read" on ad_banners for select to authenticated
  using (coalesce(public.can_manage_outlet(outlet_id), false) or coalesce(public.is_staff(), false));

-- 쓰기: 그 매체 편집장·발행인과 운영팀. 광고 코드는 운영팀만
drop policy if exists "ad_banners_insert" on ad_banners;
create policy "ad_banners_insert" on ad_banners for insert to authenticated
  with check ((coalesce(public.can_manage_outlet(outlet_id), false) or coalesce(public.is_staff(), false))
    and (kind = 'image' or coalesce(public.is_staff(), false)));
drop policy if exists "ad_banners_update" on ad_banners;
create policy "ad_banners_update" on ad_banners for update to authenticated
  using ((coalesce(public.can_manage_outlet(outlet_id), false) or coalesce(public.is_staff(), false))
    and (kind = 'image' or coalesce(public.is_staff(), false)))
  with check ((coalesce(public.can_manage_outlet(outlet_id), false) or coalesce(public.is_staff(), false))
    and (kind = 'image' or coalesce(public.is_staff(), false)));
drop policy if exists "ad_banners_delete" on ad_banners;
create policy "ad_banners_delete" on ad_banners for delete to authenticated
  using (coalesce(public.can_manage_outlet(outlet_id), false) or coalesce(public.is_staff(), false));

-- 통계 보기: 그 배너를 관리하는 사람. 쓰기는 아래 함수로만
drop policy if exists "ad_stats_read" on ad_stats;
create policy "ad_stats_read" on ad_stats for select to authenticated
  using (exists (select 1 from ad_banners b where b.id = ad_stats.banner_id
    and (coalesce(public.can_manage_outlet(b.outlet_id), false) or coalesce(public.is_staff(), false))));

-- 노출 +1 (한 페이지에 보인 배너들을 한 번에). 지금 나가는 배너만 센다
create or replace function public.ad_track_views(ids uuid[]) returns void language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Seoul')::date;
begin
  if ids is null or cardinality(ids) = 0 or cardinality(ids) > 12 then return; end if;
  insert into ad_stats (banner_id, day, views)
    select b.id, today, 1 from ad_banners b where b.id = any(ids) and public.ad_is_live(b)
  on conflict (banner_id, day) do update set views = ad_stats.views + 1;
end $$;

-- 클릭 +1 하고 이동할 주소를 돌려준다 (지금 나가는 이미지 배너만)
create or replace function public.ad_click(bid uuid) returns text language plpgsql security definer set search_path = public as $$
declare
  url text;
  today date := (now() at time zone 'Asia/Seoul')::date;
begin
  select b.link_url into url from ad_banners b where b.id = bid and b.kind = 'image' and public.ad_is_live(b);
  if url is null then return null; end if;
  insert into ad_stats (banner_id, day, clicks) values (bid, today, 1)
  on conflict (banner_id, day) do update set clicks = ad_stats.clicks + 1;
  return url;
end $$;

-- 클릭 수를 세지 않고 이동 주소만 (로봇이 눌렀을 때)
create or replace function public.ad_link(bid uuid) returns text language sql stable security definer set search_path = public as $$
  select b.link_url from ad_banners b where b.id = bid and b.kind = 'image' and public.ad_is_live(b);
$$;

revoke all on function public.ad_track_views(uuid[]), public.ad_click(uuid), public.ad_link(uuid) from public;
grant execute on function public.ad_track_views(uuid[]), public.ad_click(uuid), public.ad_link(uuid) to anon, authenticated;
grant execute on function public.ad_is_live(ad_banners) to anon, authenticated;
