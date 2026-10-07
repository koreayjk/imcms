-- 빈 매체 지우기 (Supabase SQL 에디터에서 실행, groups.sql·group-solo.sql 다음. 여러 번 실행해도 된다)
--   총관리자만, 기사·회원·청구서·결제가 하나도 없는 매체만 지운다 (테스트로 만든 매체 정리용)
--   매체를 지우면 섹션·홈 편집판·광고·홈페이지 설정이 함께 지워지고, 비게 된 개별 매체 숨은 그룹도 정리한다
--   운영 중인 매체(기사가 있는 매체)는 이 함수로 지울 수 없다

create or replace function public.admin_delete_outlet(o uuid) returns text
language plpgsql security definer set search_path = public as $$
declare
  nm text;
  grp uuid;
  n bigint;
  is_trial boolean := false;
begin
  if not coalesce(public.is_super(), false) then raise exception '매체는 총관리자만 지울 수 있습니다.'; end if;
  select name, publisher_id into nm, grp from outlets where id = o;
  if nm is null then raise exception '매체를 찾지 못했습니다.'; end if;
  if to_regprocedure('public.trial_outlet()') is not null then
    execute 'select public.trial_outlet() is not distinct from $1' into is_trial using o;
    if is_trial then raise exception '체험용 신문은 지울 수 없습니다.'; end if;
  end if;

  select count(*) into n from articles where outlet_id = o;
  if n > 0 then raise exception '%에 기사 %건이 있어 지울 수 없습니다. 테스트 매체만 지울 수 있습니다.', nm, n; end if;
  select count(*) into n from profiles where outlet_id = o;
  if n > 0 then raise exception '%에 소속 회원 %명이 있어 지울 수 없습니다. 회원 소속을 먼저 바꿔 주세요.', nm, n; end if;
  if to_regclass('public.outlet_members') is not null then
    execute 'select count(*) from outlet_members where outlet_id = $1' into n using o;
    if n > 0 then raise exception '%에 소속 회원이 있어 지울 수 없습니다.', nm; end if;
  end if;
  if to_regclass('public.invoices') is not null then
    execute 'select count(*) from invoices where outlet_id = $1' into n using o;
    if n > 0 then raise exception '%에 청구서 %건이 있어 지울 수 없습니다.', nm, n; end if;
  end if;
  if to_regclass('public.payments') is not null then
    execute 'select count(*) from payments where outlet_id = $1' into n using o;
    if n > 0 then raise exception '%에 결제 기록이 있어 지울 수 없습니다.', nm; end if;
  end if;

  delete from outlets where id = o;
  -- 개별 매체였다면 비게 된 숨은 그룹도 지운다
  if to_regprocedure('public.cleanup_solo(uuid)') is not null then perform public.cleanup_solo(grp); end if;
  return nm;
end $$;
revoke all on function public.admin_delete_outlet(uuid) from public, anon;
grant execute on function public.admin_delete_outlet(uuid) to authenticated;
