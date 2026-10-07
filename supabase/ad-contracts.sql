-- 광고 계약 장부 (Supabase SQL 에디터에서 실행, ad-banners.sql 다음. 여러 번 실행해도 된다)
--   광고주·담당자·광고 내용·기간·금액(공급가·부가세)·입금·세금계산서를 적고, 배너를 계약에 연결해 노출·클릭을 함께 본다
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

-- 배너 ↔ 계약 (계약을 지워도 배너는 남는다)
alter table ad_banners add column if not exists contract_id uuid references ad_contracts(id) on delete set null;
create index if not exists ad_banners_contract on ad_banners (contract_id) where contract_id is not null;

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
