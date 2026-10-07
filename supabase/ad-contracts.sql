-- 광고 계약 장부 (Supabase SQL 에디터에서 실행, ad-banners.sql 다음. 여러 번 실행해도 된다)
--   광고주·담당자·광고 내용·기간·금액(공급가·부가세)·입금·세금계산서를 적고, 광고 자리를 예약해 사진을 미리 올려 두면
--   그 기간에 자동으로 나가고 끝나면 내려간다. 노출·클릭도 계약별로 본다
--   흐름: 견적(자리는 아직 안 잡음) → 계약 확정(자리 예약) → 세금계산서·입금 → 게재 확인서
--   보기·쓰기: 그 매체 편집장·발행인과 총관리자만 (매출 정보라 IM 뉴스룸 매니저에게도 보이지 않는다)

create table if not exists ad_contracts (
  id uuid primary key default gen_random_uuid(),
  outlet_id uuid not null references outlets(id) on delete cascade,
  advertiser text not null check (char_length(advertiser) between 1 and 80),
  title text not null check (char_length(title) between 1 and 120),
  contact_name text check (contact_name is null or char_length(contact_name) <= 40),
  contact_phone text check (contact_phone is null or char_length(contact_phone) <= 40),
  contact_email text check (contact_email is null or char_length(contact_email) <= 120),
  starts_on date not null,
  ends_on date not null,
  supply_amount bigint not null default 0 check (supply_amount between 0 and 99999999999),
  vat_amount bigint not null default 0 check (vat_amount between 0 and 9999999999),
  paid_amount bigint not null default 0 check (paid_amount between 0 and 99999999999),
  paid_on date,
  tax_invoice_on date,
  memo text check (memo is null or char_length(memo) <= 2000),
  created_by uuid default auth.uid() references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index if not exists ad_contracts_outlet on ad_contracts (outlet_id, ends_on desc);

-- 견적 단계·광고주 사업자 정보(세금계산서용)·문서 안내 (예전에 실행한 DB에도 칸을 더한다)
alter table ad_contracts add column if not exists status text not null default 'confirmed';
alter table ad_contracts drop constraint if exists ad_contracts_status_check;
alter table ad_contracts add constraint ad_contracts_status_check check (status in ('quote', 'confirmed'));
alter table ad_contracts add column if not exists quoted_on date;
alter table ad_contracts add column if not exists biz_no text check (biz_no is null or char_length(biz_no) <= 20);
alter table ad_contracts add column if not exists biz_name text check (biz_name is null or char_length(biz_name) <= 80);
alter table ad_contracts add column if not exists biz_ceo text check (biz_ceo is null or char_length(biz_ceo) <= 40);
alter table ad_contracts add column if not exists biz_address text check (biz_address is null or char_length(biz_address) <= 200);
alter table ad_contracts add column if not exists biz_type text check (biz_type is null or char_length(biz_type) <= 60);
alter table ad_contracts add column if not exists biz_item text check (biz_item is null or char_length(biz_item) <= 60);
alter table ad_contracts add column if not exists invoice_email text check (invoice_email is null or char_length(invoice_email) <= 120);
-- 견적서·게재 확인서 아래에 넣을 안내 (예: 입금 계좌)
alter table ad_contracts add column if not exists doc_note text check (doc_note is null or char_length(doc_note) <= 500);

-- 배너 ↔ 계약 (계약 화면에서 올린 광고 소재는 계약을 지울 때 함께 내린다)
alter table ad_banners add column if not exists contract_id uuid references ad_contracts(id) on delete set null;
create index if not exists ad_banners_contract on ad_banners (contract_id) where contract_id is not null;
-- 예약 광고: 그 기간에는 이 자리를 차지한다 (같은 자리의 일반 배너는 쉬었다가 기간이 끝나면 다시 나온다)
--   한 자리에 예약 광고는 한 개(오른쪽은 세 개)까지 — 겹치는 예약은 편집국에서 막는다
alter table ad_banners add column if not exists exclusive boolean not null default false;
create index if not exists ad_banners_booking on ad_banners (outlet_id, slot) where exclusive;

-- 예약 겹침 막기: 같은 자리에 같은 날 예약 광고가 정원(오른쪽 3, 나머지 1)을 넘으면 저장하지 않는다 (한국 날짜 기준)
create or replace function public.ad_booking_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  cap int := case when new.slot = 'sidebar' then 3 else 1 end;
  d date;
  n int;
  who text;
begin
  if not new.exclusive or not new.active then return new; end if;
  if new.starts_at is null or new.ends_at is null then
    raise exception '예약 광고는 시작일과 끝나는 날이 있어야 합니다.';
  end if;
  for d in select generate_series((new.starts_at at time zone 'Asia/Seoul')::date,
                                  ((new.ends_at - interval '1 second') at time zone 'Asia/Seoul')::date, interval '1 day')::date loop
    select count(*), min(b.name) into n, who from ad_banners b
    where b.outlet_id = new.outlet_id and b.slot = new.slot and b.exclusive and b.active and b.id <> new.id
      and b.starts_at < ((d + 1)::timestamp at time zone 'Asia/Seoul') and b.ends_at > (d::timestamp at time zone 'Asia/Seoul');
    if n >= cap then
      raise exception '광고 자리 예약이 겹칩니다: % (%)', to_char(d, 'YYYY.MM.DD'), who;
    end if;
  end loop;
  return new;
end $$;
drop trigger if exists ad_booking_guard on ad_banners;
create trigger ad_booking_guard before insert or update of exclusive, active, slot, starts_at, ends_at on ad_banners
  for each row execute function public.ad_booking_guard();

create or replace function public.ad_contracts_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists ad_contracts_touch on ad_contracts;
create trigger ad_contracts_touch before update on ad_contracts for each row execute function public.ad_contracts_touch();

alter table ad_contracts enable row level security;
drop policy if exists "ad_contracts_read" on ad_contracts;
create policy "ad_contracts_read" on ad_contracts for select to authenticated
  using (coalesce(public.can_manage_outlet(outlet_id), false));
drop policy if exists "ad_contracts_insert" on ad_contracts;
create policy "ad_contracts_insert" on ad_contracts for insert to authenticated
  with check (coalesce(public.can_manage_outlet(outlet_id), false));
drop policy if exists "ad_contracts_update" on ad_contracts;
create policy "ad_contracts_update" on ad_contracts for update to authenticated
  using (coalesce(public.can_manage_outlet(outlet_id), false))
  with check (coalesce(public.can_manage_outlet(outlet_id), false));
drop policy if exists "ad_contracts_delete" on ad_contracts;
create policy "ad_contracts_delete" on ad_contracts for delete to authenticated
  using (coalesce(public.can_manage_outlet(outlet_id), false));

-- 출입 정지·2단계 인증·끊긴 로그인 확인도 겹쳐 건다 (account-security.sql 을 실행한 DB만)
do $$
begin
  if to_regprocedure('public.session_ok()') is not null then
    drop policy if exists "zz_account_ok" on ad_contracts;
    create policy "zz_account_ok" on ad_contracts as restrictive for all to authenticated
      using (public.session_ok()) with check (public.session_ok());
  end if;
end $$;

-- 확인: 매체별 계약 수
select o.name as "매체", count(c.id) as "광고 계약"
from outlets o left join ad_contracts c on c.outlet_id = o.id
group by o.name order by 2 desc, 1;
