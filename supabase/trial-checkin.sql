-- 무료 체험 5일째 자동 안내 (Supabase SQL 에디터에서 실행. 여러 번 실행해도 된다. trial.sql·support-ai.sql·press-cron.sql·mail.sql 다음)
--   체험이 이틀 남은 날(5일째) 아침 10시쯤, 체험자에게 '운영팀 안내'를 고객센터로 보내고 알림 메일을 보낸다
--   문구는 고객상담 → 무료 체험 탭에서 운영팀이 고친다. 이미 운영팀 안내를 받은 사람에게는 보내지 않는다
--   {이름} 은 받는 사람 이름으로 바뀐다

create table if not exists auto_messages (
  key text primary key,
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) between 1 and 20000),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references profiles(id) on delete set null
);
alter table auto_messages enable row level security;
drop policy if exists "auto_messages_staff" on auto_messages;
create policy "auto_messages_staff" on auto_messages for all to authenticated
  using (public.is_staff()) with check (public.is_staff());

insert into auto_messages (key, title, body) values ('trial_day5', '대표님, IM 뉴스룸 체험은 어떠세요?',
'안녕하세요, {이름}님. IM 뉴스룸입니다.
바쁘신 중에 체험해 주셔서 감사합니다. 체험 기간이 이틀 남았습니다.

아직 안 써 보셨다면 아래 두 기능을 꼭 한번 눌러 보세요.
화면 맨 위 노란 띠에서 ''편집장''으로 바꾸시면 쓸 수 있습니다.

① 홈편집: 왼쪽 메뉴 ''홈편집''에서 우리 신문 첫 화면의 헤드라인·톱 기사를 골라 배치합니다.
② 광고: ''광고''에서 배너 사진을 올리면 바로 홈페이지 자리에 나갑니다. 광고 계약을 적어 두면 날짜에 맞춰 자동으로 바뀌고, 견적서도 만들어 메일로 보낼 수 있습니다.

써 보시고 아래 세 가지만 답글로 짧게 남겨 주시면 큰 힘이 됩니다.

1. 가장 마음에 드신 점
2. 불편하거나 더 좋아졌으면 하는 점
3. 지금 쓰시는 프로그램과 비교해 아쉬운 점

말씀해 주신 내용은 바로 반영하겠습니다. 감사합니다.')
on conflict (key) do nothing;

-- 누구에게 언제 보냈는지 (한 사람에게 한 번만)
create table if not exists trial_checkins (
  user_id uuid primary key references profiles(id) on delete cascade,
  ticket_id uuid references support_tickets(id) on delete set null,
  sent_at timestamptz not null default now()
);
alter table trial_checkins enable row level security;
drop policy if exists "trial_checkins_staff" on trial_checkins;
create policy "trial_checkins_staff" on trial_checkins for select to authenticated using (public.is_staff());

-- 예약 작업이 하루 한 번 부른다 (서버 열쇠 payment_db_secret 확인): 보낼 사람에게 안내를 만들고 목록을 돌려준다 (서버가 알림 메일을 보낸다)
create or replace function public.trial_checkin_run(secret text)
returns table (ticket_id uuid, title text, body text)
language plpgsql security definer set search_path = public as $$
declare
  m auto_messages;
  r record;
  tid uuid;
  b text;
begin
  if not public.payment_secret_ok(secret) then raise exception 'not allowed'; end if;
  select * into m from auto_messages where key = 'trial_day5';
  if m is null or not m.enabled then return; end if;
  for r in
    select p.id, coalesce(nullif(p.full_name, ''), '대표') as name
    from profiles p
    where p.trial_until is not null
      and p.trial_until > now()
      and p.trial_until <= now() + interval '2 days'
      and not exists (select 1 from trial_checkins c where c.user_id = p.id)
      -- 운영팀이 이미 안내를 보낸 사람은 건너뛴다
      and not exists (select 1 from support_tickets s where s.requester_id = p.id and s.from_staff)
  loop
    b := replace(m.body, '{이름}', r.name);
    insert into support_tickets (outlet_id, requester_id, category, title, body, status, from_staff, created_by, last_staff_reply_at)
    values (null, r.id, 'etc', replace(m.title, '{이름}', r.name), b, 'in_progress', true, null, now())
    returning id into tid;
    insert into trial_checkins (user_id, ticket_id) values (r.id, tid) on conflict (user_id) do nothing;
    ticket_id := tid; title := replace(m.title, '{이름}', r.name); body := b;
    return next;
  end loop;
end $$;
revoke all on function public.trial_checkin_run(text) from public;
grant execute on function public.trial_checkin_run(text) to anon, authenticated;

-- 매일 아침 10시 (한국) 실행: 편집국 서버의 /api/cron/trial-checkin 을 깨운다 (보도자료 수집과 같은 열쇠)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from private.settings where key = 'press_cron_secret') then
    perform cron.schedule('trial-checkin', '57 0 * * *', $job$
      select net.http_get(
        url := 'https://imcms.vercel.app/api/cron/trial-checkin',
        headers := jsonb_build_object('x-cron-secret', (select value from private.settings where key = 'press_cron_secret')),
        timeout_milliseconds := 60000
      );
    $job$);
  else
    raise notice '예약 작업(pg_cron) 또는 press-cron.sql 열쇠가 없어 자동 실행은 켜지 않았습니다.';
  end if;
end $$;

-- 확인
select '체험 5일째 자동 안내' as "기능",
  case when to_regprocedure('public.trial_checkin_run(text)') is not null
        and exists (select 1 from auto_messages where key = 'trial_day5')
       then '준비됨' else '아직 안 됨' end as "결과";
