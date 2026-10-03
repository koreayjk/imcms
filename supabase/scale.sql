-- 매체가 많아질 때를 위한 준비 (Supabase SQL 에디터에서 실행. 여러 번 실행해도 된다)
--   1) 색인: 매체별 기사 목록·많이 본 기사·섹션·태그·제목 검색이 기사 수가 많아도 빠르게
--   2) 예약 작업: 자동 청구·자동결제를 여러 번 나눠 실행 (매체가 수백 곳이어도 시간 초과 없이 끝까지)

-- 1) 색인
-- 홈페이지: 매체의 발행 기사 최신순 / 섹션별 / 많이 본 기사
create index if not exists articles_outlet_published on articles (outlet_id, status, published_at desc);
create index if not exists articles_category_published on articles (category_id, status, published_at desc);
create index if not exists articles_outlet_views on articles (outlet_id, status, view_count desc);
-- 편집국: 기사목록(최근 수정순)·내 기사
create index if not exists articles_outlet_updated on articles (outlet_id, updated_at desc);
create index if not exists articles_author_updated on articles (author_id, updated_at desc);
-- 관련기사(태그가 겹치는 기사)
create index if not exists articles_tags on articles using gin (tags);
-- 매체·회원
create index if not exists categories_outlet on categories (outlet_id);
create index if not exists profiles_outlet on profiles (outlet_id);
-- 자동결제: 미납 청구서
create index if not exists invoices_unpaid_due on invoices (due_date) where status = 'unpaid';

-- 제목 검색(…포함) 색인: pg_trgm. Supabase는 확장을 extensions 스키마에 둔다 (이미 다른 곳에 있으면 그곳을 쓴다)
do $$
declare s text;
begin
  if not exists (select 1 from pg_extension where extname = 'pg_trgm') then
    if exists (select 1 from pg_namespace where nspname = 'extensions') then
      create extension pg_trgm with schema extensions;
    else
      create extension pg_trgm;
    end if;
  end if;
  select n.nspname into s from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pg_trgm';
  execute format('create index if not exists articles_title_trgm on articles using gin (title %I.gin_trgm_ops)', s);
  execute format('create index if not exists press_releases_title_trgm on press_releases using gin (title %I.gin_trgm_ops)', s);
end $$;

analyze articles;

-- 2) 예약 작업 (billing-auto.sql·payments.sql 로 이미 켜 둔 작업의 실행 시각만 바꾼다)
--   자동 청구: 매일 0시~0시 50분(한국) 10분마다. 한 번에 100초만 일하고, 남은 매체는 다음 실행이 이어서 만든다
--   자동결제: 매일 오전 10시~10시 45분(한국) 15분마다. 청구서마다 하루 한 번만 결제를 시도하는 규칙은 그대로
do $$
declare has_secret boolean := false;
begin
  if to_regclass('private.settings') is not null then
    execute $q$select exists (select 1 from private.settings where key = 'press_cron_secret')$q$ into has_secret;
  end if;
  if not exists (select 1 from pg_extension where extname = 'pg_cron') or not has_secret then
    raise notice '예약 작업(pg_cron) 또는 press-cron.sql 열쇠가 없어 예약 시각은 바꾸지 않았습니다.';
    return;
  end if;
  if exists (select 1 from cron.job where jobname = 'billing-monthly') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'billing-monthly';
    perform cron.schedule('billing-monthly', '*/10 15 * * *', $job$
      select net.http_get(
        url := 'https://imcms.vercel.app/api/cron/billing',
        headers := jsonb_build_object('x-cron-secret', (select value from private.settings where key = 'press_cron_secret')),
        timeout_milliseconds := 120000
      );
    $job$);
  end if;
  if exists (select 1 from cron.job where jobname = 'autopay-charge') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'autopay-charge';
    perform cron.schedule('autopay-charge', '0,15,30,45 1 * * *', $job$
      select net.http_get(
        url := 'https://imcms.vercel.app/api/cron/autopay',
        headers := jsonb_build_object('x-cron-secret', (select value from private.settings where key = 'press_cron_secret')),
        timeout_milliseconds := 300000
      );
    $job$);
  end if;
end $$;

-- 결과: 만들어진 색인
select indexname as "색인" from pg_indexes
where tablename in ('articles', 'categories', 'profiles', 'invoices', 'press_releases')
  and indexname in ('articles_outlet_published', 'articles_category_published', 'articles_outlet_views', 'articles_outlet_updated',
                    'articles_author_updated', 'articles_tags', 'articles_title_trgm', 'press_releases_title_trgm',
                    'categories_outlet', 'profiles_outlet', 'invoices_unpaid_due')
order by 1;
