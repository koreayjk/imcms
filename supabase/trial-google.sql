-- 1주일 무료 체험: 구글로 가입하기 (Supabase SQL 에디터에서 실행, trial.sql 다음. 여러 번 실행해도 된다)
--   구글 가입은 가입 정보(소속·연락처)를 함께 보낼 수 없어, 구글에서 돌아온 뒤 /trial/complete 화면에서 받아
--   trial_join 으로 체험 계정(IM 체험뉴스 기자, 7일)으로 바꾼다
--   이메일 인증을 마친 계정(구글은 처음부터 인증됨)만, 아직 다른 매체 회원이 아닌 계정만 바꿀 수 있다

create or replace function public.trial_join(p_name text, p_company text, p_position text, p_phone text, p_agreed_at timestamptz)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  o uuid := public.trial_outlet();
  me profiles%rowtype;
  u auth.users%rowtype;
  claims text;
  sub text;
begin
  if uid is null then raise exception '로그인이 필요합니다.'; end if;
  if o is null then raise exception '체험신문이 아직 준비되지 않았습니다.'; end if;
  select * into me from profiles where id = uid;
  select * into u from auth.users where id = uid;
  if me.id is null then raise exception '회원 정보를 찾지 못했습니다. 잠시 뒤 다시 시도해 주세요.'; end if;
  if me.trial_until is not null then
    if me.trial_until > now() then return; end if;
    raise exception '이미 체험을 마친 계정입니다. 정식 이용은 서비스 신청으로 문의해 주세요.';
  end if;
  if coalesce((to_jsonb(me) ->> 'is_super')::boolean, false) or me.approved or me.role = 'admin' then
    raise exception '이미 편집국 회원인 계정입니다. 체험은 다른 구글 계정으로 해 주세요.';
  end if;
  if u.email_confirmed_at is null then raise exception '이메일 인증을 먼저 마쳐 주세요.'; end if;
  if nullif(trim(p_company), '') is null or nullif(trim(p_phone), '') is null or p_agreed_at is null then
    raise exception '소속 언론사·휴대전화와 동의가 필요합니다.';
  end if;

  -- 권한 보호 트리거(protect_profile_fields)·체험 보호 트리거는 로그인 사용자의 변경을 막으므로, 아래 변경은 로그인 정보 없이 처리한다
  claims := current_setting('request.jwt.claims', true);
  sub := current_setting('request.jwt.claim.sub', true);
  perform set_config('request.jwt.claims', '', true);
  perform set_config('request.jwt.claim.sub', '', true);
  update profiles set
    outlet_id = o, approved = true, role = 'reporter', publisher_id = null,
    trial_until = now() + interval '7 days',
    full_name = left(coalesce(nullif(trim(p_name), ''), me.full_name, split_part(u.email, '@', 1)), 30)
  where id = uid;

  -- signup-outlet.sql 의 신청 매체 칸 (없으면 건너뜀)
  begin
    execute 'update profiles set requested_outlet_id = null where id = $1' using uid;
  exception when undefined_column then null;
  end;
  -- newsroom-settings.sql 의 기자별 AI 한도 (없으면 매체 한도만 적용)
  begin
    execute 'insert into ai_member_limits (outlet_id, profile_id, monthly_limit) values ($1, $2, 30)
             on conflict (outlet_id, profile_id) do update set monthly_limit = 30' using o, uid;
  exception when undefined_table then null;
  end;
  insert into trial_signups (user_id, email, name, company, position, phone, agreed_at)
  values (uid, u.email, left(coalesce(nullif(trim(p_name), ''), me.full_name), 30), left(trim(p_company), 80),
          left(nullif(trim(p_position), ''), 40), left(trim(p_phone), 30), p_agreed_at)
  on conflict (user_id) do nothing;
  perform set_config('request.jwt.claims', coalesce(claims, ''), true);
  perform set_config('request.jwt.claim.sub', coalesce(sub, ''), true);
end $$;
revoke all on function public.trial_join(text, text, text, text, timestamptz) from public, anon;
grant execute on function public.trial_join(text, text, text, text, timestamptz) to authenticated;
