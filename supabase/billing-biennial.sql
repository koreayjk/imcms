-- 2년 결제 추가 (Supabase SQL 에디터에서 1회 실행. service-apply.sql·billing-auto.sql 다음. 여러 번 실행해도 된다)
--   신청서의 결제 방식(beta_requests.billing)과 매체별 자동 청구 주기(outlet_plans.cycle)가
--   월 결제·1년 결제 말고 2년 결제(biennial)도 받도록 허용한다. 금액은 서버가 요금표로 계산하므로 다른 변경은 없다.
--   실행 전에도 신청서는 받아진다 (2년 결제는 요청사항에 적어서 저장된다)

do $$
declare c record;
begin
  -- 예전 확인 조건(월·1년만 허용)을 찾아 지운다
  for c in
    select con.conname, rel.relname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace n on n.oid = rel.relnamespace
    where n.nspname = 'public' and con.contype = 'c'
      and rel.relname in ('beta_requests', 'outlet_plans')
      and pg_get_constraintdef(con.oid) ~ 'annual'
  loop
    execute format('alter table public.%I drop constraint %I', c.relname, c.conname);
  end loop;

  if to_regclass('public.beta_requests') is not null then
    alter table public.beta_requests add constraint beta_requests_billing_check
      check (billing is null or billing in ('monthly', 'annual', 'biennial'));
  end if;
  if to_regclass('public.outlet_plans') is not null then
    alter table public.outlet_plans add constraint outlet_plans_cycle_check
      check (cycle in ('monthly', 'annual', 'biennial'));
  end if;
end $$;

select '2년 결제 설치 완료' as "결과";
